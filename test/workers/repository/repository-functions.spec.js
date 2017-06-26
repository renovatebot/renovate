const repositoryWorker = require('../../../lib/workers/repository/index');
const packageFileWorker = require('../../../lib/workers/package-file');
const branchWorker = require('../../../lib/workers/branch');
const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/branch');
jest.mock('../../../lib/workers/package-file');

describe('workers/repository', () => {
  describe('determineRepoUpgrades(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        logger,
      };
    });
    it('returns empty array if no packageFiles', async () => {
      config.packageFiles = [];
      const upgrades = await repositoryWorker.determineRepoUpgrades(config);
      expect(upgrades.length).toBe(0);
    });
    it('returns empty array if none found', async () => {
      config.packageFiles = [
        'package.json',
        {
          packageFile: 'backend/package.json',
        },
      ];
      packageFileWorker.processPackageFile.mockReturnValue([]);
      const upgrades = await repositoryWorker.determineRepoUpgrades(config);
      expect(upgrades.length).toBe(0);
    });
    it('returns array if upgrades found', async () => {
      config.packageFiles = [
        'package.json',
        {
          packageFile: 'backend/package.json',
        },
        {
          fileName: 'frontend/package.json',
        },
      ];
      packageFileWorker.processPackageFile.mockReturnValueOnce(['a']);
      packageFileWorker.processPackageFile.mockReturnValueOnce(['b', 'c']);
      const upgrades = await repositoryWorker.determineRepoUpgrades(config);
      expect(upgrades.length).toBe(3);
    });
  });
  describe('groupUpgradesByBranch(upgrades, logger)', () => {
    it('returns empty object if no input array', async () => {
      const res = await repositoryWorker.groupUpgradesByBranch([], logger);
      expect(res).toEqual({});
    });
    it('returns one branch if one input', async () => {
      const upgrades = [
        {
          branchName: 'foo-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await repositoryWorker.groupUpgradesByBranch(
        upgrades,
        logger
      );
      expect(Object.keys(res).length).toBe(1);
      expect(res).toMatchSnapshot();
    });
    it('does not group if different compiled branch names', async () => {
      const upgrades = [
        {
          branchName: 'foo-{{version}}',
          version: '1.1.0',
        },
        {
          branchName: 'foo-{{version}}',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await repositoryWorker.groupUpgradesByBranch(
        upgrades,
        logger
      );
      expect(Object.keys(res).length).toBe(3);
      expect(res).toMatchSnapshot();
    });
    it('groups if same compiled branch names', async () => {
      const upgrades = [
        {
          branchName: 'foo',
          version: '1.1.0',
        },
        {
          branchName: 'foo',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
        },
      ];
      const res = await repositoryWorker.groupUpgradesByBranch(
        upgrades,
        logger
      );
      expect(Object.keys(res).length).toBe(2);
      expect(res).toMatchSnapshot();
    });
    it('groups if same compiled group name', async () => {
      const upgrades = [
        {
          branchName: 'foo',
          version: '1.1.0',
          groupName: 'My Group',
          groupBranchName: 'renovate/{{groupSlug}}',
        },
        {
          branchName: 'foo',
          version: '2.0.0',
        },
        {
          branchName: 'bar-{{version}}',
          version: '1.1.0',
          groupName: 'My Group',
          groupBranchName: 'renovate/my-group',
        },
      ];
      const res = await repositoryWorker.groupUpgradesByBranch(
        upgrades,
        logger
      );
      expect(Object.keys(res).length).toBe(2);
      expect(res).toMatchSnapshot();
    });
  });
  describe('updateBranchesSequentially(branchUpgrades, logger)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('handles empty case', async () => {
      await repositoryWorker.updateBranchesSequentially({}, logger);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(0);
    });
    it('updates branches', async () => {
      const branchUpgrades = {
        foo: {},
        bar: {},
        baz: {},
      };
      await repositoryWorker.updateBranchesSequentially(branchUpgrades, logger);
      expect(branchWorker.updateBranch.mock.calls.length).toBe(3);
    });
  });
  describe('processRepo(repoConfig)', () => {
    // TODO
  });
});
