const jsonValidator = require('json-dup-key-validator');

const apis = require('../../../lib/workers/repository/apis');
const logger = require('../../_fixtures/logger');

const githubApi = require('../../../lib/api/github');
const gitlabApi = require('../../../lib/api/gitlab');
const npmApi = require('../../../lib/api/npm');

jest.mock('../../../lib/api/github');
jest.mock('../../../lib/api/gitlab');
jest.mock('../../../lib/api/npm');

describe('workers/repository/apis', () => {
  describe('setNpmrc(config)', () => {
    it('Skips if npmrc not found', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(),
        },
      };
      await apis.setNpmrc(config);
    });
    it('Parses if npmrc found', async () => {
      const config = {
        api: {
          getFileContent: jest.fn(() => 'a = b'),
        },
        logger,
      };
      await apis.setNpmrc(config);
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
      await apis.setNpmrc(config);
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
  describe('checkForLerna(config)', () => {
    it('swallows lerna 404', async () => {
      const config = {
        api: {
          getFileJson: jest.fn(() => ({})),
          getSubDirectories: jest.fn(() => {
            throw new Error('some-error');
          }),
        },
        logger,
      };
      const res = await apis.checkForLerna(config);
      expect(res).toMatchSnapshot();
    });
    it('ignores zero length lerna', async () => {
      const config = {
        api: {
          getFileJson: jest.fn(() => ({ packages: ['packages/*'] })),
          getSubDirectories: jest.fn(() => []),
        },
        logger,
      };
      const res = await apis.checkForLerna(config);
      expect(res).toMatchSnapshot();
    });
    it('returns lerna package names', async () => {
      const config = {
        api: {
          getFileJson: jest.fn(() => ({ packages: ['packages/*'] })),
          getSubDirectories: jest.fn(() => ['a', 'b']),
        },
        logger,
      };
      const res = await apis.checkForLerna(config);
      expect(res).toMatchSnapshot();
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
      expect(npmApi.setNpmrc.mock.calls.length).toBe(1);
    });
    it('returns gitlab api', async () => {
      const config = { logger, platform: 'gitlab' };
      const res = await apis.initApis(config);
      expect(res.platform).toEqual('gitlab');
      expect(githubApi.initRepo.mock.calls.length).toBe(0);
      expect(gitlabApi.initRepo.mock.calls.length).toBe(1);
      expect(npmApi.setNpmrc.mock.calls.length).toBe(1);
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
      config.api.getFileContent.mockReturnValueOnce(
        '{ "enabled": true, "foo": false, "maintainYarnLock": true }'
      );
      const returnConfig = await apis.mergeRenovateJson(config);
      expect(returnConfig.enabled).toBe(true);
      expect(returnConfig.renovateJsonPresent).toBe(true);
      expect(returnConfig.errors).toHaveLength(0); // TODO: Update to 1 later
      expect(returnConfig.errors).toMatchSnapshot();
    });
    it('returns error plus extended config if duplicate keys', async () => {
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
        api: {
          findFilePaths: jest.fn(() => [
            'package.json',
            'backend/package.json',
          ]),
        },
        logger,
        warnings: [],
      };
      const res = await apis.detectPackageFiles(config);
      expect(res).toMatchObject(config);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('ignores node modules', async () => {
      const config = {
        ignoreNodeModules: true,
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
      expect(res.foundNodeModules).toMatchSnapshot();
      expect(res.warnings).toMatchSnapshot();
    });
    it('defaults to package.json if found', async () => {
      const config = {
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
          getFileContent: jest.fn(),
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
      config.api.getFileJson.mockReturnValueOnce({ renovate: {} });
      config.api.getFileJson.mockReturnValueOnce({});
      config.api.getFileContent.mockReturnValueOnce(true);
      config.api.getFileContent.mockReturnValueOnce(true);
      const res = await apis.resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(2);
      expect(res.packageFiles).toMatchSnapshot();
    });
  });
});
