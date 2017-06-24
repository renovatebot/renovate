const repositoryWorker = require('../../lib/workers/repository');
const packageFileWorker = require('../../lib/workers/package-file');
const branchWorker = require('../../lib/workers/branch');
const logger = require('../_fixtures/logger');

const githubApi = require('../../lib/api/github');
const gitlabApi = require('../../lib/api/gitlab');
const npmApi = require('../../lib/api/npm');

jest.mock('../../lib/api/github');
jest.mock('../../lib/api/gitlab');
jest.mock('../../lib/api/npm');
jest.mock('../../lib/workers/branch');
jest.mock('../../lib/workers/package-file');

describe('workers/repository', () => {
  describe('setNpmrc(config)', () => {
    it('Skips if npmrc not found', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(),
        },
      };
      await repositoryWorker.setNpmrc(config);
    });
    it('Parses if npmrc found', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(() => 'a = b'),
        },
        logger,
      };
      await repositoryWorker.setNpmrc(config);
    });
    it('Catches errors', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(() => {
            throw new Error('file error');
          }),
        },
        logger,
      };
      await repositoryWorker.setNpmrc(config);
    });
  });
  describe('initApis(config)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns github api', async () => {
      const config = { platform: 'github' };
      const res = await repositoryWorker.initApis(config);
      expect(res.platform).toEqual('github');
      expect(githubApi.initRepo.mock.calls.length).toBe(1);
      expect(gitlabApi.initRepo.mock.calls.length).toBe(0);
      expect(npmApi.setNpmrc.mock.calls.length).toBe(1);
    });
    it('returns gitlab api', async () => {
      const config = { platform: 'gitlab' };
      const res = await repositoryWorker.initApis(config);
      expect(res.platform).toEqual('gitlab');
      expect(githubApi.initRepo.mock.calls.length).toBe(0);
      expect(gitlabApi.initRepo.mock.calls.length).toBe(1);
      expect(npmApi.setNpmrc.mock.calls.length).toBe(1);
    });
    it('throws if unknown platform', async () => {
      const config = { platform: 'foo' };
      let e;
      try {
        await repositoryWorker.initApis(config);
      } catch (err) {
        e = err;
      }
      expect(e.message).toMatchSnapshot();
      expect(githubApi.initRepo.mock.calls.length).toBe(0);
      expect(gitlabApi.initRepo.mock.calls.length).toBe(0);
      expect(npmApi.setNpmrc.mock.calls.length).toBe(0);
    });
  });
  describe('mergeRenovateJson(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          getFileJson: jest.fn(),
        },
        logger,
      };
    });
    it('returns same config if no renovate.json found', async () => {
      expect(await repositoryWorker.mergeRenovateJson(config)).toEqual(config);
    });
    it('returns extended config if renovate.json found', async () => {
      config.api.getFileJson.mockReturnValueOnce({ foo: 1 });
      const returnConfig = await repositoryWorker.mergeRenovateJson(config);
      expect(returnConfig.foo).toBe(1);
      expect(returnConfig.renovateJsonPresent).toBe(true);
    });
  });
  describe('onboardRepository(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          commitFilesToBranch: jest.fn(),
          createPr: jest.fn(() => ({ displayNumber: 1 })),
        },
        logger,
      };
    });
    it('should commit files and create PR', async () => {
      config.platform = 'github';
      await repositoryWorker.onboardRepository(config);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Pull Request')
      ).not.toBe(-1);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Merge Request')
      ).toBe(-1);
    });
    it('should adapt for gitlab phrasing', async () => {
      config.platform = 'gitlab';
      await repositoryWorker.onboardRepository(config);
      expect(config.api.createPr.mock.calls[0][2].indexOf('Pull Request')).toBe(
        -1
      );
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Merge Request')
      ).not.toBe(-1);
    });
  });
  describe('getOnboardingStatus(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          commitFilesToBranch: jest.fn(),
          createPr: jest.fn(() => ({ displayNumber: 1 })),
          findPr: jest.fn(),
        },
        logger,
      };
    });
    it('returns true if onboarding is false', async () => {
      config.onboarding = false;
      const res = await repositoryWorker.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns complete if renovate onboarded', async () => {
      config.renovateJsonPresent = true;
      const res = await repositoryWorker.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns complete if pr and pr is closed', async () => {
      config.api.findPr.mockReturnValueOnce({ isClosed: true });
      const res = await repositoryWorker.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns in progres if pr and pr is not closed', async () => {
      config.api.findPr.mockReturnValueOnce({});
      const res = await repositoryWorker.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns none if no pr', async () => {
      const res = await repositoryWorker.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
  });
  describe('detectPackageFiles(config)', () => {
    it('adds package files to object', async () => {
      const config = {
        api: {
          findFilePaths: jest.fn(() => [
            'package.json',
            'backend/package.json',
          ]),
        },
        logger,
      };
      const res = await repositoryWorker.detectPackageFiles(config);
      expect(res).toMatchObject(config);
      expect(res.packageFiles).toMatchSnapshot();
    });
  });
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
