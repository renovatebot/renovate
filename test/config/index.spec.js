const argv = require('../_fixtures/config/argv');
const defaultConfig = require('../../lib/config/defaults').getConfig();

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser;
    let defaultArgv;
    let ghGot;
    let get;
    let vstsApi;
    let vstsHelper;
    beforeEach(() => {
      jest.resetModules();
      configParser = require('../../lib/config/index.js');
      defaultArgv = argv();
      jest.mock('gh-got');
      ghGot = require('gh-got');
      jest.mock('gl-got');
      get = require('gl-got');
      jest.mock('../../lib/platform/vsts/vsts-got-wrapper');
      vstsApi = require('../../lib/platform/vsts/vsts-got-wrapper');
      jest.mock('../../lib/platform/vsts/vsts-helper');
      vstsHelper = require('../../lib/platform/vsts/vsts-helper');
    });
    it('throws for invalid platform', async () => {
      const env = {};
      defaultArgv.push('--platform=foo');
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('Unsupported platform: foo.');
    });
    it('throws for no GitHub token', async () => {
      const env = {};
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('You need to supply a GitHub token.');
    });
    it('throws for no GitLab token', async () => {
      const env = { RENOVATE_PLATFORM: 'gitlab' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('You need to supply a GitLab token.');
    });
    it('throws for no vsts token', async () => {
      const env = { RENOVATE_PLATFORM: 'vsts' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('You need to supply a VSTS token.');
    });
    it('supports token in env', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      await configParser.parseConfigs(env, defaultArgv);
    });
    it('supports token in CLI options', async () => {
      defaultArgv = defaultArgv.concat(['--token=abc']);
      const env = {};
      await configParser.parseConfigs(env, defaultArgv);
    });
    it('autodiscovers github platform', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat(['--autodiscover', '--token=abc']);
      ghGot.mockImplementationOnce(() => ({
        headers: {},
        body: [
          {
            full_name: 'a/b',
          },
          {
            full_name: 'c/d',
          },
        ],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(1);
      expect(get.mock.calls.length).toBe(0);
    });
    it('autodiscovers gitlab platform', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat([
        '--autodiscover',
        '--platform=gitlab',
        '--token=abc',
      ]);
      get.mockImplementationOnce(() => ({
        headers: {},
        body: [
          {
            path_with_namespace: 'a/b',
          },
        ],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(0);
      expect(get.mock.calls.length).toBe(1);
    });
    it('autodiscovers vsts platform', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat([
        '--autodiscover',
        '--platform=vsts',
        '--token=abc',
      ]);
      vstsHelper.getFile.mockImplementationOnce(() => `Hello Renovate!`);
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getRepositories: jest.fn(() => [
          {
            name: 'repo1',
            project: {
              name: 'prj1',
            },
          },
          {
            name: 'repo2',
            project: {
              name: 'prj1',
            },
          },
        ]),
      }));
      vstsHelper.getProjectAndRepo.mockImplementationOnce(() => ({
        project: 'prj1',
        repo: 'repo1',
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(0);
      expect(get.mock.calls.length).toBe(0);
      expect(vstsApi.gitApi.mock.calls.length).toBe(1);
    });
    it('logs if no autodiscovered repositories', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      defaultArgv = defaultArgv.concat(['--autodiscover']);
      ghGot.mockImplementationOnce(() => ({
        headers: {},
        body: [],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(1);
      expect(get.mock.calls.length).toBe(0);
    });
    it('adds a log file', async () => {
      const env = { GITHUB_TOKEN: 'abc', RENOVATE_LOG_FILE: 'debug.log' };
      defaultArgv = defaultArgv.concat(['--autodiscover']);
      ghGot.mockImplementationOnce(() => ({
        headers: {},
        body: [],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(1);
      expect(get.mock.calls.length).toBe(0);
    });
  });
  describe('mergeChildConfig(parentConfig, childConfig)', () => {
    it('merges', () => {
      const parentConfig = { ...defaultConfig };
      const childConfig = {
        foo: 'bar',
        pinVersions: false,
        lockFileMaintenance: {
          schedule: ['on monday'],
        },
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.foo).toEqual('bar');
      expect(config.pinVersions).toBe(false);
      expect(config.lockFileMaintenance.schedule).toEqual(['on monday']);
      expect(config.lockFileMaintenance).toMatchSnapshot();
    });
    it('merges depTypes', () => {
      const parentConfig = { ...defaultConfig };
      const childConfig = {
        dependencies: {},
        devDependencies: { foo: 1 },
        peerDependencies: {},
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.depTypes).toMatchSnapshot();
    });
    it('merges packageRules', () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        packageRules: [{ a: 1 }, { a: 2 }],
      });
      const childConfig = {
        packageRules: [{ a: 3 }, { a: 4 }],
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules.map(rule => rule.a)).toMatchObject([
        1,
        2,
        3,
        4,
      ]);
    });
    it('handles null parent packageRules', () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        packageRules: null,
      });
      const childConfig = {
        packageRules: [{ a: 3 }, { a: 4 }],
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules).toHaveLength(2);
    });
    it('handles null child packageRules', () => {
      const parentConfig = { ...defaultConfig };
      parentConfig.packageRules = [{ a: 3 }, { a: 4 }];
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, {});
      expect(config.packageRules).toHaveLength(2);
    });
    it('handles undefined childConfig', () => {
      const parentConfig = { ...defaultConfig };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, undefined);
      expect(config).toMatchObject(parentConfig);
    });
  });
});
