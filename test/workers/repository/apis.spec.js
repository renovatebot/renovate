const jsonValidator = require('json-dup-key-validator');

const apis = require('../../../lib/workers/repository/apis');
const logger = require('../../_fixtures/logger');

const githubApi = require('../../../lib/api/github');
const gitlabApi = require('../../../lib/api/gitlab');
const npmApi = require('../../../lib/api/npm');

const defaultConfig = require('../../../lib/config/defaults').getConfig();

jest.mock('../../../lib/api/github');
jest.mock('../../../lib/api/gitlab');
jest.mock('../../../lib/api/npm');

describe('workers/repository/apis', () => {
  describe('getNpmrc', () => {
    it('Skips if ignoring npmrc', async () => {
      const config = {
        foo: 1,
        ignoreNpmrcFile: true,
      };
      expect(await apis.getNpmrc(config)).toMatchObject(config);
    });
    it('Skips if npmrc not found', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(),
        },
      };
      expect(await apis.getNpmrc(config)).toMatchObject(config);
    });
    it('Parses if npmrc found', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(() => 'a = b'),
        },
        logger,
      };
      const res = await apis.getNpmrc(config);
      expect(res.npmrc).toEqual('a = b');
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
      expect(await apis.getNpmrc(config)).toMatchObject(config);
    });
  });
  describe('checkMonorepos', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: {
          getFileJson: jest.fn(),
        },
        logger,
      };
    });
    it('adds yarn workspaces', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: { workspaces: ['packages/*'] },
        },
        {
          packageFile: 'packages/something/package.json',
          content: { name: '@a/b' },
        },
        {
          packageFile: 'packages/something-else/package.json',
          content: { name: '@a/c' },
        },
      ];
      const res = await apis.checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
    it('adds nested yarn workspaces', async () => {
      config.packageFiles = [
        {
          packageFile: 'frontend/package.json',
          content: { workspaces: ['packages/*'] },
        },
        {
          packageFile: 'frontend/packages/something/package.json',
          content: { name: '@a/b' },
        },
        {
          packageFile: 'frontend/packages/something-else/package.json',
          content: { name: '@a/c' },
        },
      ];
      const res = await apis.checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
    it('adds lerna packages', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: {},
        },
        {
          packageFile: 'packages/something/package.json',
          content: { name: '@a/b' },
        },
        {
          packageFile: 'packages/something-else/package.json',
          content: { name: '@a/c' },
        },
      ];
      config.api.getFileJson.mockReturnValue({ packages: ['packages/*'] });
      const res = await apis.checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
    it('skips if no lerna packages', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: {},
        },
      ];
      config.api.getFileJson.mockReturnValue({});
      const res = await apis.checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
  });
  describe('detectSemanticCommits', () => {
    it('disables semantic commits', async () => {
      const config = {
        api: {
          getCommitMessages: jest.fn(() => []),
        },
        logger,
      };
      const res = await apis.detectSemanticCommits(config);
      expect(res).toEqual(false);
    });
    it('enables semantic commits', async () => {
      const config = {
        api: {
          getCommitMessages: jest.fn(() => []),
        },
        logger,
      };
      config.api.getCommitMessages.mockReturnValueOnce(['fix: something']);
      const res = await apis.detectSemanticCommits(config);
      expect(res).toEqual(true);
    });
  });
  describe('initApis(config)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns github api', async () => {
      const config = { logger, platform: 'github', semanticCommits: null };
      const res = await apis.initApis(config);
      expect(res.platform).toEqual('github');
      expect(githubApi.initRepo.mock.calls.length).toBe(1);
      expect(gitlabApi.initRepo.mock.calls.length).toBe(0);
      expect(npmApi.setNpmrc.mock.calls.length).toBe(0);
    });
    it('returns gitlab api', async () => {
      const config = { logger, platform: 'gitlab' };
      const res = await apis.initApis(config);
      expect(res.platform).toEqual('gitlab');
      expect(githubApi.initRepo.mock.calls.length).toBe(0);
      expect(gitlabApi.initRepo.mock.calls.length).toBe(1);
      expect(npmApi.setNpmrc.mock.calls.length).toBe(0);
    });
    it('throws if unknown platform', async () => {
      const config = { platform: 'foo' };
      let e;
      try {
        await apis.initApis(config);
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
        errors: [],
        warnings: [],
        api: {
          getFileContent: jest.fn(),
        },
        logger,
      };
    });
    it('returns same config if no renovate.json found', async () => {
      expect(await apis.mergeRenovateJson(config)).toEqual(config);
    });
    it('returns extended config if renovate.json found', async () => {
      config.api.getFileContent.mockReturnValueOnce('{ "enabled": true }');
      const returnConfig = await apis.mergeRenovateJson(config);
      expect(returnConfig.enabled).toBe(true);
      expect(returnConfig.renovateJsonPresent).toBe(true);
      expect(returnConfig.errors).toHaveLength(0);
    });
    it('returns warning + error plus extended config if unknown keys', async () => {
      config.repoIsOnboarded = true;
      config.api.getFileContent.mockReturnValueOnce(
        '{ "enabled": true, "foo": false, "maintainYarnLock": true, "schedule": "before 5am", "minor": {} }'
      );
      const returnConfig = await apis.mergeRenovateJson(config);
      expect(returnConfig.enabled).toBe(true);
      expect(returnConfig.renovateJsonPresent).toBe(true);
      expect(returnConfig.errors).toHaveLength(0); // TODO: Update to 1 later
      expect(returnConfig.errors).toMatchSnapshot();
    });
    it('returns error plus extended config if duplicate keys', async () => {
      config.repoIsOnboarded = true;
      config.api.getFileContent.mockReturnValueOnce(
        '{ "enabled": true, "enabled": false }'
      );
      const returnConfig = await apis.mergeRenovateJson(config);
      expect(returnConfig.enabled).toBe(false);
      expect(returnConfig.renovateJsonPresent).toBe(true);
      expect(returnConfig.errors).toHaveLength(1);
      expect(returnConfig.errors).toMatchSnapshot();
    });
    it('returns error in config if renovate.json cannot be parsed', async () => {
      config.api.getFileContent.mockReturnValueOnce('{ enabled: true }');
      const returnConfig = await apis.mergeRenovateJson(config);
      expect(returnConfig.enabled).toBeUndefined();
      expect(returnConfig.renovateJsonPresent).toBeUndefined();
      expect(returnConfig.errors).toMatchSnapshot();
    });
    it('returns error in JSON.parse', async () => {
      config.api.getFileContent.mockReturnValueOnce('{ enabled: true }');
      jsonValidator.validate = jest.fn();
      jsonValidator.validate.mockReturnValueOnce(false);
      jsonValidator.validate.mockReturnValueOnce(false);
      let e;
      try {
        await apis.mergeRenovateJson(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
  describe('detectPackageFiles(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: {
          findFilePaths: jest.fn(),
          getFileContent: jest.fn(),
        },
        logger,
        warnings: [],
      };
      config.api.findFilePaths.mockReturnValue([]);
    });
    it('adds package files to object', async () => {
      config.api.findFilePaths.mockReturnValueOnce([
        'package.json',
        'backend/package.json',
      ]);
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(2);
    });
    it('finds meteor package files', async () => {
      config.meteor.enabled = true;
      config.api.findFilePaths.mockReturnValueOnce([]); // package.json
      config.api.findFilePaths.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      config.api.findFilePaths.mockReturnValueOnce([]); // Dockerfile
      config.api.getFileContent.mockReturnValueOnce('Npm.depends( {} )');
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
    });
    it('skips meteor package files with no json', async () => {
      config.meteor.enabled = true;
      config.api.findFilePaths.mockReturnValueOnce([]); // package.json
      config.api.findFilePaths.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      config.api.findFilePaths.mockReturnValueOnce([]); // Dockerfile
      config.api.getFileContent.mockReturnValueOnce('Npm.depends(packages)');
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(0);
    });
    it('finds Dockerfiles', async () => {
      config.api.findFilePaths.mockReturnValueOnce([]);
      config.api.findFilePaths.mockReturnValueOnce([]);
      config.api.findFilePaths.mockReturnValueOnce(['Dockerfile']);
      config.docker.enabled = true;
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
    });
    it('ignores node modules', async () => {
      config.api.findFilePaths.mockReturnValueOnce([
        'package.json',
        'node_modules/backend/package.json',
      ]);
      config.api.findFilePaths.mockReturnValueOnce([]);
      config.api.findFilePaths.mockReturnValueOnce([]);
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
      expect(res.foundIgnoredPaths).toMatchSnapshot();
      expect(res.warnings).toMatchSnapshot();
    });
  });
  describe('resolvePackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        errors: [],
        warnings: [],
        packageFiles: ['package.json', { packageFile: 'a/package.json' }],
        api: {
          getFileContent: jest.fn(() => null),
        },
        logger,
      };
    });
    it('skips files with no content', async () => {
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toEqual([]);
    });
    it('skips files with invalid JSON', async () => {
      config.api.getFileContent.mockReturnValueOnce('not json');
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toEqual([]);
    });
    it('includes files with content', async () => {
      config.repoIsOnboarded = true;
      config.api.getFileContent.mockReturnValueOnce(
        JSON.stringify({
          renovate: {},
          workspaces: [],
        })
      );
      config.api.getFileContent.mockReturnValueOnce('npmrc-1');
      config.api.getFileContent.mockReturnValueOnce('yarnrc-1');
      config.api.getFileContent.mockReturnValueOnce('yarnLock-1');
      config.api.getFileContent.mockReturnValueOnce('packageLock-1');
      config.api.getFileContent.mockReturnValueOnce('{}');
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(2);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('handles meteor', async () => {
      config.packageFiles = [{ packageFile: 'package.js' }];
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(1);
    });
    it('handles dockerfile', async () => {
      config.packageFiles = [{ packageFile: 'Dockerfile' }];
      config.api.getFileContent.mockReturnValueOnce(
        '# some content\nFROM node:8\nRUN something'
      );
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(1);
    });
    it('handles dockerfile with no FROM', async () => {
      config.packageFiles = [{ packageFile: 'Dockerfile' }];
      config.api.getFileContent.mockReturnValueOnce(
        '# some content\n# FROM node:8\nRUN something'
      );
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(0);
    });
  });
});
describe('migrateAndValidate', () => {
  it('returns empty config', () => {
    const renovateJson = {};
    const res = apis.migrateAndValidate(defaultConfig, renovateJson);
    expect(res).toMatchSnapshot();
  });
  it('massages string to array', () => {
    const renovateJson = {
      schedule: 'before 5am',
    };
    const res = apis.migrateAndValidate(defaultConfig, renovateJson);
    expect(Array.isArray(res.schedule)).toBe(true);
  });
});
