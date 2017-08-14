const branchWorker = require('../../../lib/workers/branch');
const prWorker = require('../../../lib/workers/pr');
const schedule = require('../../../lib/workers/branch/schedule');
const npm = require('../../../lib/workers/branch/npm');
const yarn = require('../../../lib/workers/branch/yarn');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const packageJsonHelper = require('../../../lib/workers/branch/package-json');

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/branch/yarn');
jest.mock('../../../lib/workers/branch/package-json');

describe('workers/branch', () => {
  describe('getParentBranch(branchName, config)', () => {
    let config;
    const branchName = 'foo';
    beforeEach(() => {
      schedule.isScheduledNow = jest.fn();
      config = {
        api: {
          branchExists: jest.fn(() => true),
          deleteBranch: jest.fn(),
          getBranchPr: jest.fn(),
          getBranchStatus: jest.fn(),
          isBranchStale: jest.fn(() => false),
        },
      };
    });
    it('returns undefined if branch does not exist', async () => {
      config.api.branchExists.mockReturnValue(false);
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        undefined
      );
    });
    it('returns branchName if no PR', async () => {
      config.api.getBranchPr.mockReturnValue(null);
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        branchName
      );
    });
    it('returns branchName if does not need rebaseing', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: false,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        branchName
      );
    });
    it('returns branchName if unmergeable and cannot rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        branchName
      );
    });
    it('returns undefined if unmergeable and can rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        undefined
      );
    });
    it('returns undefined if unmergeable and can rebase (gitlab)', async () => {
      config.isGitLab = true;
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        undefined
      );
      expect(config.api.deleteBranch.mock.calls.length).toBe(1);
    });
    it('returns branchName if automerge branch-push and not stale', async () => {
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        branchName
      );
    });
    it('returns undefined if automerge branch-push and stale', async () => {
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      config.api.isBranchStale.mockReturnValueOnce(true);
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(
        undefined
      );
    });
    it('returns branch if rebaseStalePrs enabled but cannot rebase', async () => {
      config.rebaseStalePrs = true;
      config.api.isBranchStale.mockReturnValueOnce(true);
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).not.toBe(
        undefined
      );
    });
  });
  describe('ensureBranch(config)', () => {
    let config;
    beforeEach(() => {
      packageJsonHelper.setNewValue = jest.fn();
      branchWorker.getParentBranch = jest.fn();
      npm.getLockFile = jest.fn();
      npm.maintainLockFile = jest.fn();
      yarn.getLockFile = jest.fn();
      yarn.maintainLockFile = jest.fn();
      config = { ...defaultConfig };
      config.api = {};
      config.api.getFileContent = jest.fn();
      config.api.branchExists = jest.fn();
      config.api.commitFilesToBranch = jest.fn();
      config.api.getFileContent.mockReturnValueOnce('old content');
      config.api.getBranchStatus = jest.fn();
      config.api.getBranchStatusCheck = jest.fn();
      config.api.setBranchStatus = jest.fn();
      config.depName = 'dummy';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.1.0';
      config.newVersionMajor = 1;
      config.versions = {};
      config.upgrades = [{ ...config }];
    });
    it('returns if new content matches old', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('old content');
      config.api.branchExists.mockReturnValueOnce(false);
      expect(await branchWorker.ensureBranch(config)).toBe(false);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(0);
      expect(yarn.getLockFile.mock.calls.length).toBe(0);
    });
    it('commits one file if no yarn lock or package-lock.json found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.semanticCommits = true;
      expect(await branchWorker.ensureBranch(config)).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('returns true if automerging pr', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.automergeEnabled = true;
      config.automergeType = 'pr';
      expect(await branchWorker.ensureBranch(config)).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
      expect(config.api.setBranchStatus.mock.calls).toHaveLength(0);
    });
    it('sets branch status pending', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.unpublishSafe = true;
      config.upgrades[0].unpublishable = true;
      config.upgrades.push({ ...config });
      config.upgrades[1].unpublishable = false;
      expect(await branchWorker.ensureBranch(config)).toBe(true);
      expect(config.api.setBranchStatus.mock.calls).toHaveLength(1);
    });
    it('skips branch status pending', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.unpublishSafe = true;
      config.api.getBranchStatusCheck.mockReturnValueOnce('pending');
      config.upgrades[0].unpublishable = true;
      config.upgrades.push({ ...config });
      config.upgrades[1].unpublishable = false;
      expect(await branchWorker.ensureBranch(config)).toBe(true);
      expect(config.api.setBranchStatus.mock.calls).toHaveLength(0);
    });
    it('skips branch status success if setting disabled', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.upgrades[0].unpublishable = true;
      config.api.getBranchStatusCheck.mockReturnValueOnce('pending');
      expect(await branchWorker.ensureBranch(config)).toBe(true);
      expect(config.api.setBranchStatus.mock.calls).toHaveLength(1);
    });
    it('automerges successful branches', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.api.getBranchStatus.mockReturnValueOnce('success');
      config.api.mergeBranch = jest.fn();
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      expect(await branchWorker.ensureBranch(config)).toBe(false);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(config.api.getBranchStatus.mock.calls.length).toBe(1);
      expect(config.api.mergeBranch.mock).toMatchSnapshot();
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('skips automerge if status not success', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.api.getBranchStatus.mockReturnValueOnce('pending');
      config.api.mergeBranch = jest.fn();
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      expect(await branchWorker.ensureBranch(config)).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(config.api.getBranchStatus.mock.calls.length).toBe(1);
      expect(config.api.mergeBranch.mock.calls.length).toBe(0);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('throws if automerge throws', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.api.getBranchStatus.mockReturnValueOnce('success');
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      config.api.mergeBranch = jest.fn(() => {
        throw new Error('automerge failed');
      });
      let e;
      try {
        await branchWorker.ensureBranch(config);
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(config.api.getBranchStatus.mock.calls.length).toBe(1);
      expect(config.api.mergeBranch.mock).toMatchSnapshot();
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('commits two files if yarn lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      yarn.getLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch(config);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(2);
    });
    it('commits two files if package lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      npm.getLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch(config);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(2);
    });
    it('commits three files if yarn lock and package lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      npm.getLockFile.mockReturnValueOnce('non null response');
      yarn.getLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch(config);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(3);
    });
    it('throws an error if no yarn lock generation possible', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      yarn.getLockFile.mockImplementationOnce(() => {
        throw new Error('yarn not found');
      });
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      let err;
      try {
        await branchWorker.ensureBranch(config);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('yarn not found');
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(0);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('throws an error if no package lock generation possible', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      npm.getLockFile.mockImplementationOnce(() => {
        throw new Error('no package lock generated');
      });
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      let err;
      try {
        await branchWorker.ensureBranch(config);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('no package lock generated');
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(yarn.getLockFile.mock.calls.length).toBe(1);
      expect(npm.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('maintains lock files if needing updates', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      yarn.maintainLockFile.mockReturnValueOnce('non null response');
      npm.maintainLockFile.mockReturnValueOnce('non null response');
      config.upgrades[0].type = 'lockFileMaintenance';
      config.upgrades[0].hasYarnLock = true;
      config.upgrades[0].hasPackageLock = true;
      await branchWorker.ensureBranch(config);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(0);
      expect(yarn.getLockFile.mock.calls.length).toBe(0);
      expect(npm.getLockFile.mock.calls.length).toBe(0);
      expect(yarn.maintainLockFile.mock.calls.length).toBe(1);
      expect(npm.maintainLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(2);
    });
    it('skips maintaining lock files if no updates', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      config.upgrades[0].type = 'lockFileMaintenance';
      config.upgrades[0].hasYarnLock = true;
      config.upgrades[0].hasPackageLock = true;
      await branchWorker.ensureBranch(config);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(0);
      expect(yarn.getLockFile.mock.calls.length).toBe(0);
      expect(npm.getLockFile.mock.calls.length).toBe(0);
      expect(yarn.maintainLockFile.mock.calls.length).toBe(1);
      expect(npm.maintainLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('throws error if cannot maintain yarn.lock file', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      config.upgrades[0].type = 'lockFileMaintenance';
      config.upgrades[0].hasYarnLock = true;
      yarn.maintainLockFile.mockImplementationOnce(() => {
        throw new Error('yarn not found');
      });
      let err;
      try {
        await branchWorker.ensureBranch(config);
      } catch (e) {
        err = e;
      }
      expect(err.message).toMatchSnapshot();
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(0);
      expect(yarn.getLockFile.mock.calls.length).toBe(0);
      expect(npm.getLockFile.mock.calls.length).toBe(0);
      expect(yarn.maintainLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
  });
  describe('processBranchUpgrades(upgrades)', () => {
    let config;
    beforeEach(() => {
      config = { ...defaultConfig };
      config.api = {
        checkForClosedPr: jest.fn(),
      };
      config.logger = logger;
      branchWorker.ensureBranch = jest.fn(() => true);
      prWorker.ensurePr = jest.fn(() => true);
      config.upgrades = [{ depName: 'a' }];
    });
    it('skips branch if not scheduled', async () => {
      config.schedule = ['some-schedule'];
      schedule.isScheduledNow.mockReturnValueOnce(false);
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
    it('returns immediately if closed PR found', async () => {
      config.api.checkForClosedPr.mockReturnValue(true);
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
    it('returns if legacy closed major PR found', async () => {
      config.branchName = 'renovate/a-2.x';
      config.prTitle = 'Upgrade a to v2';
      config.api.checkForClosedPr.mockReturnValueOnce(false);
      config.api.checkForClosedPr.mockReturnValueOnce(true);
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
      expect(config.api.checkForClosedPr.mock.calls).toMatchSnapshot();
    });
    it('returns if legacy closed minor PR found', async () => {
      config.branchName = 'renovate/a-2.x';
      config.prTitle = 'Upgrade a to v2.1.0';
      config.api.checkForClosedPr.mockReturnValueOnce(false);
      config.api.checkForClosedPr.mockReturnValueOnce(true);
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
      expect(config.api.checkForClosedPr.mock.calls).toMatchSnapshot();
    });
    it('does not return immediately if recreateClosed true', async () => {
      config.api.checkForClosedPr.mockReturnValue(true);
      config.recreateClosed = true;
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('pins', async () => {
      config.type = 'pin';
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('majors', async () => {
      config.type = 'major';
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('minors', async () => {
      config.type = 'minor';
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('handles semantic commits', async () => {
      config.type = 'minor';
      config.semanticCommits = true;
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(1);
    });
    it('handles errors', async () => {
      config.api.checkForClosedPr = jest.fn(() => {
        throw new Error('oops');
      });
      await branchWorker.processBranchUpgrades(config);
      expect(branchWorker.ensureBranch.mock.calls.length).toBe(0);
    });
    it('handles known errors', async () => {
      branchWorker.ensureBranch.mockImplementationOnce(() => {
        throw Error('Error generating lock file');
      });
      await branchWorker.processBranchUpgrades(config);
    });
  });
});
