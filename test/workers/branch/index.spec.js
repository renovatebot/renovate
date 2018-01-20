const branchWorker = require('../../../lib/workers/branch');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

const schedule = require('../../../lib/workers/branch/schedule');
const checkExisting = require('../../../lib/workers/branch/check-existing');
const parent = require('../../../lib/workers/branch/parent');
const manager = require('../../../lib/manager');
const lockFiles = require('../../../lib/workers/branch/lock-files');
const commit = require('../../../lib/workers/branch/commit');
const statusChecks = require('../../../lib/workers/branch/status-checks');
const automerge = require('../../../lib/workers/branch/automerge');
const prWorker = require('../../../lib/workers/pr');

jest.mock('../../../lib/manager');
jest.mock('../../../lib/workers/branch/schedule');
jest.mock('../../../lib/workers/branch/check-existing');
jest.mock('../../../lib/workers/branch/parent');
jest.mock('../../../lib/workers/branch/lock-files');
jest.mock('../../../lib/workers/branch/status-checks');
jest.mock('../../../lib/workers/branch/automerge');
jest.mock('../../../lib/workers/pr');

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
      commit.commitFilesToBranch = jest.fn(() => true);
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
    it('processes branch if not scheduled but updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = true;
      platform.branchExists.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
    });
    it('skips branch if closed major PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      config.isMajor = true;
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch.mock.calls.length).toBe(0);
    });
    it('skips branch if closed digest PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      config.isDigest = true;
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch.mock.calls.length).toBe(0);
    });
    it('skips branch if closed minor PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'closed',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch.mock.calls.length).toBe(0);
    });
    it('skips branch if merged PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      checkExisting.prAlreadyExisted.mockReturnValueOnce({
        number: 13,
        state: 'merged',
      });
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch.mock.calls.length).toBe(0);
    });
    it('skips branch if edited PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      platform.findPr.mockReturnValueOnce({});
      platform.getPr.mockReturnValueOnce({ state: 'open', canRebase: false });
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pr-edited');
    });
    it('warns if edited PR is actually closed', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      platform.branchExists.mockReturnValueOnce(true);
      platform.findPr.mockReturnValueOnce({});
      platform.getPr.mockReturnValueOnce({ state: 'closed' });
      const res = await branchWorker.processBranch(config);
      expect(res).not.toEqual('pr-edited');
    });
    it('returns if pr creation limit exceeded', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [],
      });
      platform.branchExists.mockReturnValueOnce(false);
      config.prHourlyLimitReached = true;
      expect(await branchWorker.processBranch(config)).toEqual(
        'pr-hourly-limit-reached'
      );
    });
    it('returns if no work', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [],
      });
      platform.branchExists.mockReturnValueOnce(false);
      expect(await branchWorker.processBranch(config)).toEqual('no-work');
    });
    it('returns if branch automerged', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('automerged');
      await branchWorker.processBranch(config);
      expect(statusChecks.setUnpublishable.mock.calls).toHaveLength(1);
      expect(automerge.tryBranchAutomerge.mock.calls).toHaveLength(1);
      expect(prWorker.ensurePr.mock.calls).toHaveLength(0);
    });
    it('ensures PR and tries automerge', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
      expect(prWorker.ensurePr.mock.calls).toHaveLength(1);
      expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(1);
      expect(prWorker.checkAutoMerge.mock.calls).toHaveLength(1);
    });
    it('ensures PR and adds lock file error comment', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      config.lockFileErrors = [{}];
      await branchWorker.processBranch(config);
      expect(platform.ensureComment.mock.calls).toHaveLength(1);
      expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr.mock.calls).toHaveLength(1);
      expect(prWorker.checkAutoMerge.mock.calls).toHaveLength(0);
    });
    it('ensures PR and adds lock file error comment recreate closed', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      config.recreateClosed = true;
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce('failed');
      prWorker.ensurePr.mockReturnValueOnce({});
      prWorker.checkAutoMerge.mockReturnValueOnce(true);
      config.lockFileErrors = [{}];
      await branchWorker.processBranch(config);
      expect(platform.ensureComment.mock.calls).toHaveLength(1);
      expect(platform.ensureCommentRemoval.mock.calls).toHaveLength(0);
      expect(prWorker.ensurePr.mock.calls).toHaveLength(1);
      expect(prWorker.checkAutoMerge.mock.calls).toHaveLength(0);
    });
    it('swallows branch errors', async () => {
      manager.getUpdatedPackageFiles.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });
    it('throws and swallows branch errors', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: true,
        updatedLockFiles: [{}],
      });
      await branchWorker.processBranch(config);
    });
    it('swallows pr errors', async () => {
      manager.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      });
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      platform.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce(false);
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });
  });
});
