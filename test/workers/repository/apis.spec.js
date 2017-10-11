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
      const returnConfig = await apis.mergeRenovateJson(config);
      expect(returnConfig.foo).toBeUndefined();
      expect(returnConfig.renovateJsonPresent).toBeUndefined();
      expect(returnConfig.errors).toMatchSnapshot();
    });
  });
  describe('detectPackageFiles(config)', () => {
    it('adds package files to object', async () => {
      const config = {
        ...defaultConfig,
        api: {
          findFilePaths: jest.fn(() => [
            'package.json',
            'backend/package.json',
          ]),
        },
        meteor: {
          enabled: false,
        },
        logger,
        warnings: [],
      };
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('finds meteor package files', async () => {
      const config = {
        ...defaultConfig,
        api: {
          findFilePaths: jest.fn(),
        },
        logger,
        warnings: [],
      };
      config.api.findFilePaths.mockReturnValueOnce(['package.json']);
      config.api.findFilePaths.mockReturnValueOnce([
        'modules/something/package.js',
      ]);
      config.api.findFilePaths.mockReturnValueOnce([]);
      config.meteor.enabled = true;
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('finds Dockerfiles', async () => {
      const config = {
        ...defaultConfig,
        api: {
          findFilePaths: jest.fn(),
        },
        logger,
        warnings: [],
      };
      config.api.findFilePaths.mockReturnValueOnce(['package.json']);
      config.api.findFilePaths.mockReturnValueOnce([]);
      config.api.findFilePaths.mockReturnValueOnce(['Dockerfile']);
      config.docker.enabled = true;
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('ignores node modules', async () => {
      const config = {
        ...defaultConfig,
        ignorePaths: ['node_modules/'],
        api: {
          findFilePaths: jest.fn(() => [
            'package.json',
            'node_modules/backend/package.json',
          ]),
        },
        logger,
        warnings: [],
      };
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.foundIgnoredPaths).toMatchSnapshot();
      expect(res.warnings).toMatchSnapshot();
    });
    it('defaults to package.json if found', async () => {
      const config = {
        ...defaultConfig,
        api: {
          findFilePaths: jest.fn(() => []),
          getFileJson: jest.fn(() => ({})),
        },
        logger,
      };
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toHaveLength(1);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('returns empty if package.json not found', async () => {
      const config = {
        ...defaultConfig,
        api: {
          findFilePaths: jest.fn(() => []),
          getFileJson: jest.fn(() => null),
        },
        logger,
      };
      const res = await apis.detectPackageFiles(config);
      expect(res.packageFiles).toEqual([]);
    });
  });
  describe('resolvePackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        packageFiles: ['package.json', { packageFile: 'a/package.json' }],
        api: {
          getFileContent: jest.fn(() => null),
          getFileJson: jest.fn(),
        },
        logger,
      };
    });
    it('skips files with no content', async () => {
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toEqual([]);
    });
    it('includes files with content', async () => {
      config.packageFiles.push('module/package.js');
      config.api.getFileJson.mockReturnValueOnce({
        renovate: {},
        workspaces: [],
      });
      config.api.getFileJson.mockReturnValueOnce({});
      config.api.getFileContent.mockReturnValueOnce(null);
      config.api.getFileContent.mockReturnValueOnce(null);
      config.api.getFileContent.mockReturnValueOnce('some-content');
      config.api.getFileContent.mockReturnValueOnce('some-content');
      config.api.getFileContent.mockReturnValueOnce(null);
      config.api.getFileContent.mockReturnValueOnce(null);
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(3);
      expect(res.packageFiles).toMatchSnapshot();
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
