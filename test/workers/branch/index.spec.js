const branchWorker = require('../../../lib/workers/branch');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

const schedule = require('../../../lib/workers/branch/schedule');
const checkExisting = require('../../../lib/workers/branch/check-existing');
const parent = require('../../../lib/workers/branch/parent');
const packageFiles = require('../../../lib/workers/branch/package-files');
const lockFiles = require('../../../lib/workers/branch/lock-files');
const commit = require('../../../lib/workers/branch/commit');
const statusChecks = require('../../../lib/workers/branch/status-checks');
const automerge = require('../../../lib/workers/branch/automerge');
const prWorker = require('../../../lib/workers/pr');

jest.mock('../../../lib/workers/branch/schedule');
jest.mock('../../../lib/workers/branch/check-existing');
jest.mock('../../../lib/workers/branch/parent');
jest.mock('../../../lib/workers/branch/package-files');
jest.mock('../../../lib/workers/branch/lock-files');
jest.mock('../../../lib/workers/branch/commit');
jest.mock('../../../lib/workers/branch/status-checks');
jest.mock('../../../lib/workers/branch/automerge');
jest.mock('../../../lib/workers/pr');

const logger = require('../../_fixtures/logger');

describe('workers/branch', () => {
  describe('processBranch', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: { branchExists: jest.fn() },
        logger,
        upgrades: [{}],
      };
      schedule.isScheduledNow.mockReturnValue(true);
    });
    it('skips branch if not scheduled', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      await branchWorker.processBranch(config);
      expect(checkExisting.prAlreadyExisted.mock.calls).toHaveLength(0);
    });
    it('skips branch if closed PR found', async () => {
      checkExisting.prAlreadyExisted.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
      expect(parent.getParentBranch.mock.calls.length).toBe(0);
    });
    it('returns if no branch exists', async () => {
      packageFiles.getUpdatedPackageFiles.mockReturnValueOnce([]);
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [],
      });
      config.api.branchExists.mockReturnValueOnce(false);
      await branchWorker.processBranch(config);
      expect(commit.commitFilesToBranch.mock.calls).toHaveLength(1);
    });
    it('returns if branch automerged', async () => {
      packageFiles.getUpdatedPackageFiles.mockReturnValueOnce([{}]);
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      config.api.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce(true);
      await branchWorker.processBranch(config);
      expect(statusChecks.setUnpublishable.mock.calls).toHaveLength(1);
      expect(automerge.tryBranchAutomerge.mock.calls).toHaveLength(1);
      expect(prWorker.ensurePr.mock.calls).toHaveLength(0);
    });
    it('ensures PR and tries automerge', async () => {
      packageFiles.getUpdatedPackageFiles.mockReturnValueOnce([{}]);
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      config.api.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce(false);
      prWorker.ensurePr.mockReturnValueOnce({});
      await branchWorker.processBranch(config);
      expect(prWorker.ensurePr.mock.calls).toHaveLength(1);
      expect(prWorker.checkAutoMerge.mock.calls).toHaveLength(1);
    });
    it('swallows branch errors', async () => {
      packageFiles.getUpdatedPackageFiles.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });
    it('throws and swallows branch errors', async () => {
      packageFiles.getUpdatedPackageFiles.mockReturnValueOnce([{}]);
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: true,
        updatedLockFiles: [{}],
      });
      await branchWorker.processBranch(config);
    });
    it('swallows pr errors', async () => {
      packageFiles.getUpdatedPackageFiles.mockReturnValueOnce([{}]);
      lockFiles.getUpdatedLockFiles.mockReturnValueOnce({
        lockFileError: false,
        updatedLockFiles: [{}],
      });
      config.api.branchExists.mockReturnValueOnce(true);
      automerge.tryBranchAutomerge.mockReturnValueOnce(false);
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      await branchWorker.processBranch(config);
    });
  });
});
