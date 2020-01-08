import * as branchWorker from '../../../lib/workers/branch';
import * as _schedule from '../../../lib/workers/branch/schedule';
import * as _checkExisting from '../../../lib/workers/branch/check-existing';
import * as _parent from '../../../lib/workers/branch/parent';
import * as _npmPostExtract from '../../../lib/manager/npm/post-update';
import * as _commit from '../../../lib/workers/branch/commit';
import * as _statusChecks from '../../../lib/workers/branch/status-checks';
import * as _automerge from '../../../lib/workers/branch/automerge';
import * as _prWorker from '../../../lib/workers/pr';
import * as _getUpdated from '../../../lib/workers/branch/get-updated';
import { defaultConfig, platform, mocked } from '../../util';
import { BranchConfig } from '../../../lib/workers/common';
import {
  MANAGER_LOCKFILE_ERROR,
  REPOSITORY_CHANGED,
} from '../../../lib/constants/error-messages';

jest.mock('../../../lib/workers/branch/get-updated');
jest.mock('../../../lib/workers/branch/schedule');
jest.mock('../../../lib/workers/branch/check-existing');
jest.mock('../../../lib/workers/branch/parent');
jest.mock('../../../lib/manager/npm/post-update');
jest.mock('../../../lib/workers/branch/status-checks');
jest.mock('../../../lib/workers/branch/automerge');
jest.mock('../../../lib/workers/branch/commit');
jest.mock('../../../lib/workers/pr');

const getUpdated = mocked(_getUpdated);
const schedule = mocked(_schedule);
const checkExisting = mocked(_checkExisting);
const parent = mocked(_parent);
const npmPostExtract = mocked(_npmPostExtract);
const statusChecks = mocked(_statusChecks);
const automerge = mocked(_automerge);
const commit = mocked(_commit);
const prWorker = mocked(_prWorker);

describe('workers/branch', () => {
  describe('processBranch', () => {
    const updatedPackageFiles: _getUpdated.PackageFilesResult = {
      updatedPackageFiles: [],
      artifactErrors: [],
      updatedArtifacts: [],
    };
    let config: BranchConfig;
    beforeEach(() => {
      prWorker.ensurePr = jest.fn();
      prWorker.checkAutoMerge = jest.fn();
      config = {
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        errors: [],
        warnings: [],
        upgrades: [{ depName: 'some-dep-name' } as never],
      } as never;
      schedule.isScheduledNow.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValue(true);
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
      platform.branchExists.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('not-scheduled');
    });
    it('skips branch if not unpublishSafe + pending', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.unpublishSafe = true;
      config.canBeUnpublished = true;
      config.prCreation = 'not-pending';
      platform.branchExists.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pending');
    });
    it('skips branch if not stabilityDays not met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      config.upgrades = [
        {
          releaseTimestamp: '2099-12-31',
          stabilityDays: 1,
        } as never,
      ];
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pending');
    });
    it('processes branch if not scheduled but updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = true;
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'open',
        isModified: false,
      } as never);
      await branchWorker.processBranch(config);
    });
    it('skips branch if closed major PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      config.updateType = 'major';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: 'closed',
      } as never);
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed digest PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      config.updateType = 'digest';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed minor PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if merged PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: 'merged',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch).toHaveBeenCalledTimes(0);
    });
    it('throws error if closed PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'merged',
        isModified: true,
      } as never);
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        REPOSITORY_CHANGED
      );
    });
    it('does not skip branch if edited PR found with rebaseLabel', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'open',
        isModified: true,
        labels: ['rebase'],
      } as never);
      const res = await branchWorker.processBranch(config);
      expect(res).not.toEqual('pr-edited');
    });
    it('skips branch if edited PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'open',
        isModified: true,
      } as never);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pr-edited');
    });
    it('skips branch if target branch changed', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'open',
        isModified: false,
        targetBranch: 'v6',
      } as never);
      config.baseBranch = 'master';
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pr-edited');
    });
    it('returns if pr creation limit exceeded', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      platform.branchExists.mockResolvedValue(false);
      expect(await branchWorker.processBranch(config, true)).toEqual(
        'pr-hourly-limit-reached'
      );
    });
    it('returns if no work', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      platform.branchExists.mockResolvedValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(false);
      expect(await branchWorker.processBranch(config)).toEqual('no-work');
    });
    it('returns if branch automerged', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch(config);
      expect(statusChecks.setUnpublishable).toHaveBeenCalledTimes(1);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });
    it('returns if branch automerged (dry-run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch({ ...config, dryRun: true });
      expect(statusChecks.setUnpublishable).toHaveBeenCalledTimes(1);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });
    it('returns if branch exists and prCreation set to approval', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce('needs-pr-approval');
      expect(await branchWorker.processBranch(config)).toEqual(
        'needs-pr-approval'
      );
    });
    it('returns if branch exists but pending', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce('pending');
      expect(await branchWorker.processBranch(config)).toEqual('pending');
    });
    it('ensures PR and tries automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      await branchWorker.processBranch(config);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(1);
    });
    it('ensures PR and adds lock file error comment if no releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if old releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      config.releaseTimestamp = '2018-04-26T05:15:51.877Z';
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if new releaseTimestamp and branch exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      config.releaseTimestamp = new Date().toISOString();
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      // expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('throws error if lock file errors and new releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(false);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      config.releaseTimestamp = new Date().toISOString();
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        Error(MANAGER_LOCKFILE_ERROR)
      );
    });
    it('ensures PR and adds lock file error comment recreate closed', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      config.recreateClosed = true;
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
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
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      await branchWorker.processBranch(config);
    });
    it('swallows pr errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce(false as never);
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });

    it('closed pr (dry run)', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({ state: 'closed' });
      expect(
        await branchWorker.processBranch({ ...config, dryRun: true })
      ).toEqual('already-existed');
    });

    it('branch pr no rebase (dry run)', async () => {
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: 'open',
        isModified: true,
      } as never);
      expect(
        await branchWorker.processBranch({ ...config, dryRun: true })
      ).toEqual('pr-edited');
    });

    it('branch pr no schedule lockfile (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- rebase-check -->`,
        isModified: true,
      } as never);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(false);

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
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- rebase-check -->`,
        isModified: true,
      } as never);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      prWorker.ensurePr.mockResolvedValueOnce({} as never);
      expect(
        await branchWorker.processBranch({
          ...config,
          dryRun: true,
          artifactErrors: [{}],
        })
      ).toEqual('done');
    });

    it('branch pr no schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      platform.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- rebase-check -->`,
        isModified: true,
      } as never);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(false);
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
