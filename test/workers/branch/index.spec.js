const branchWorker = require('../../../lib/workers/branch');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

/** @type any */
const schedule = require('../../../lib/workers/branch/schedule');
/** @type any */
const checkExisting = require('../../../lib/workers/branch/check-existing');
/** @type any */
const parent = require('../../../lib/workers/branch/parent');
/** @type any */
const npmPostExtract = require('../../../lib/manager/npm/post-update');
/** @type any */
const commit = require('../../../lib/workers/branch/commit');
const statusChecks = require('../../../lib/workers/branch/status-checks');
/** @type any */
const automerge = require('../../../lib/workers/branch/automerge');
/** @type any */
const prWorker = require('../../../lib/workers/pr');
/** @type any */
const getUpdated = require('../../../lib/workers/branch/get-updated');
const { appSlug } = require('../../../lib/config/app-strings');

jest.mock('../../../lib/workers/branch/get-updated');
jest.mock('../../../lib/workers/branch/schedule');
jest.mock('../../../lib/workers/branch/check-existing');
jest.mock('../../../lib/workers/branch/parent');
jest.mock('../../../lib/manager/npm/post-update');
jest.mock('../../../lib/workers/branch/status-checks');
jest.mock('../../../lib/workers/branch/automerge');
jest.mock('../../../lib/workers/branch/commit');
jest.mock('../../../lib/workers/pr');

/** @type any */
const platform = global.platform;

describe('workers/branch', () => {
  describe('processBranch', () => {
    let config;
    beforeEach(() => {
      prWorker.ensurePr = jest.fn();
      prWorker.checkAutoMerge = jest.fn();
      config = {
        ...defaultConfig,
        errors: [],
        warnings: [],
        upgrades: [{ depName: 'some-dep-name' }],
      };
      schedule.isScheduledNow.mockReturnValue(true);
      commit.commitFilesToBranch.mockReturnValue(true);
    });
    afterEach(() => {
      platform.ensureComment.mockClear();
      platform.ensureCommentRemoval.mockClear();
      commit.commitFilesToBranch.mockClear();
      jest.resetAllMocks();
    });
    it('skips branch if not scheduled and branch does not exist', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('not-scheduled');
    });
    it('skips branch if not scheduled and not updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = false;
      platform.branchExists.mockReturnValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('not-scheduled');
    });
    it('skips branch if not unpublishSafe + pending', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.unpublishSafe = true;
      config.canBeUnpublished = true;
      config.prCreation = 'not-pending';
      platform.branchExists.mockReturnValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pending');
    });
    it('processes branch if not scheduled but updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = true;
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValueOnce({
        state: 'open',
        canRebase: true,
      });
      await branchWorker.processBranch(config);
    });
    it('skips branch if closed major PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      config.updateType = 'major';
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed digest PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      config.updateType = 'digest';
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed minor PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if merged PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'merged',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('throws error if closed PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValueOnce({
        state: 'merged',
        canRebase: false,
      });
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        /repository-changed/
      );
    });
    it('does not skip branch if edited PR found with rebaseLabel', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValueOnce({
        state: 'open',
        canRebase: false,
        labels: ['rebase'],
      });
      const res = await branchWorker.processBranch(config);
      expect(res).not.toEqual('pr-edited');
    });
    it('skips branch if edited PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockReturnValueOnce({
        state: 'open',
        canRebase: false,
      });
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pr-edited');
    });
    it('returns if pr creation limit exceeded', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      platform.branchExists.mockReturnValue(false);
      expect(await branchWorker.processBranch(config, true)).toEqual(
        'pr-hourly-limit-reached'
      );
    });
    it('returns if no work', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      platform.branchExists.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockReturnValueOnce(false);
      expect(await branchWorker.processBranch(config)).toEqual('no-work');
    });
    it('returns if branch automerged', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('automerged');
      await branchWorker.processBranch(config);
      expect(statusChecks.setUnpublishable).toHaveBeenCalledTimes(1);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });
    it('returns if branch exists and prCreation set to approval', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce('needs-pr-approval');
      expect(await branchWorker.processBranch(config)).toEqual(
        'needs-pr-approval'
      );
    });
    it('ensures PR and tries automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(1);
    });
    it('ensures PR and adds lock file error comment if no releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if old releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      config.releaseTimestamp = '2018-04-26T05:15:51.877Z';
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if new releaseTimestamp and branch exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      config.releaseTimestamp = new Date().toISOString();
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('throws error if lock file errors and new releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(false);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      config.releaseTimestamp = new Date().toISOString();
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        Error('lockfile-error')
      );
    });
    it('ensures PR and adds lock file error comment recreate closed', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      });
      config.recreateClosed = true;
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });
    it('throws and swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      });
      await branchWorker.processBranch(config);
    });
    it('swallows pr errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce(false);
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });

    it('closed pr (dry run)', async () => {
      platform.branchExists.mockReturnValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({ state: 'closed' });
      expect(
        await branchWorker.processBranch({ ...config, dryRun: true })
      ).toEqual('already-existed');
    });

    it('branch pr no rebase (dry run)', async () => {
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'open',
        canRebase: false,
      });
      expect(
        await branchWorker.processBranch({ ...config, dryRun: true })
      ).toEqual('pr-edited');
    });

    it('branch pr no schedule lockfile (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- ${appSlug}-rebase -->`,
        canRebase: false,
      });

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockReturnValueOnce(false);

      expect(
        await branchWorker.processBranch({
          ...config,
          dryRun: true,
          updateType: 'lockFileMaintenance',
          parentBranch: undefined,
          updatedArtifacts: [{ name: '|delete|', contents: 'dummy' }],
        })
      ).toEqual('done');
    });

    it('branch pr no schedule (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- ${appSlug}-rebase -->`,
        canRebase: false,
      });

      schedule.isScheduledNow.mockReturnValueOnce(false);
      prWorker.ensurePr.mockResolvedValueOnce({});
      expect(
        await branchWorker.processBranch({
          ...config,
          dryRun: true,
          artifactErrors: [{}],
        })
      ).toEqual('done');
    });

    it('branch pr no schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [],
      });
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- ${appSlug}-rebase -->`,
        canRebase: false,
      });

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockReturnValueOnce(false);
      expect(
        await branchWorker.processBranch({
          ...config,
          updateType: 'lockFileMaintenance',
          parentBranch: undefined,
          updatedArtifacts: [{ name: '|delete|', contents: 'dummy' }],
        })
      ).toEqual('done');
    });
  });
});
