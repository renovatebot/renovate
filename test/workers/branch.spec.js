const branchWorker = require('../../lib/workers/branch');
const npmHelper = require('../../lib/helpers/npm');
const yarnHelper = require('../../lib/helpers/yarn');
const defaultConfig = require('../../lib/config/defaults').getConfig();
const packageJsonHelper = require('../../lib/helpers/package-json');

jest.mock('../../lib/helpers/yarn');
jest.mock('../../lib/helpers/package-json');

describe('workers/branch', () => {
  describe('getParentBranch(branchName, config)', () => {
    let config;
    const branchName = 'foo';
    beforeEach(() => {
      config = {
        api: {
          branchExists: jest.fn(() => true),
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
  });
  describe('ensureBranch(config)', () => {
    let config;
    beforeEach(() => {
      packageJsonHelper.setNewValue = jest.fn();
      branchWorker.getParentBranch = jest.fn();
      npmHelper.getLockFile = jest.fn();
      yarnHelper.getLockFile = jest.fn();
      yarnHelper.maintainLockFile = jest.fn();
      config = Object.assign({}, defaultConfig);
      config.api = {};
      config.api.getFileContent = jest.fn();
      config.api.branchExists = jest.fn();
      config.api.commitFilesToBranch = jest.fn();
      config.api.getFileContent.mockReturnValueOnce('old content');
      config.api.getBranchStatus = jest.fn();
      config.depName = 'dummy';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.1.0';
      config.newVersionMajor = 1;
    });
    it('returns if new content matches old', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('old content');
      config.api.branchExists.mockReturnValueOnce(false);
      expect(await branchWorker.ensureBranch([config])).toBe(false);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(0);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(0);
    });
    it('commits one file if no yarn lock or package-lock.json found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      expect(await branchWorker.ensureBranch([config])).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('returns true if automerging pr', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.automergeEnabled = true;
      config.automergeType = 'pr';
      expect(await branchWorker.ensureBranch([config])).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('automerges successful branches', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      config.api.branchExists.mockReturnValueOnce(true);
      config.api.getBranchStatus.mockReturnValueOnce('success');
      config.api.mergeBranch = jest.fn();
      config.automergeEnabled = true;
      config.automergeType = 'branch-push';
      expect(await branchWorker.ensureBranch([config])).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(config.api.getBranchStatus.mock.calls.length).toBe(1);
      expect(config.api.mergeBranch.mock).toMatchSnapshot();
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
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
      expect(await branchWorker.ensureBranch([config])).toBe(true);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(config.api.getBranchStatus.mock.calls.length).toBe(1);
      expect(config.api.mergeBranch.mock.calls.length).toBe(0);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
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
        await branchWorker.ensureBranch([config]);
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(config.api.getBranchStatus.mock.calls.length).toBe(1);
      expect(config.api.mergeBranch.mock).toMatchSnapshot();
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('commits two files if yarn lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      yarnHelper.getLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(2);
    });
    it('commits two files if package lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      npmHelper.getLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(2);
    });
    it('commits three files if yarn lock and package lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      npmHelper.getLockFile.mockReturnValueOnce('non null response');
      yarnHelper.getLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(3);
    });
    it('throws an error if no yarn lock generation possible', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      yarnHelper.getLockFile.mockImplementationOnce(() => {
        throw new Error('yarn not found');
      });
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      let err;
      try {
        await branchWorker.ensureBranch([config]);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('Could not generate new yarn.lock file');
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(0);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('throws an error if no package lock generation possible', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      npmHelper.getLockFile.mockImplementationOnce(() => {
        throw new Error('no package lock generated');
      });
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      let err;
      try {
        await branchWorker.ensureBranch([config]);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('Could not generate new package-lock.json file');
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(1);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('maintains lock files if needing updates', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      yarnHelper.maintainLockFile.mockReturnValueOnce('non null response');
      config.upgradeType = 'maintainYarnLock';
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(0);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(0);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(0);
      expect(yarnHelper.maintainLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('skips maintaining lock files if no updates', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      config.upgradeType = 'maintainYarnLock';
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(0);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(0);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(0);
      expect(yarnHelper.maintainLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('throws error if cannot maintain yarn.lock file', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      config.upgradeType = 'maintainYarnLock';
      yarnHelper.maintainLockFile.mockImplementationOnce(() => {
        throw new Error('yarn not found');
      });
      let err;
      try {
        await branchWorker.ensureBranch([config]);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('Could not maintain yarn.lock file');
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(0);
      expect(yarnHelper.getLockFile.mock.calls.length).toBe(0);
      expect(npmHelper.getLockFile.mock.calls.length).toBe(0);
      expect(yarnHelper.maintainLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
  });
});
