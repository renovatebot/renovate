const argv = require('../_fixtures/config/argv');
const defaultConfig = require('../../lib/config/defaults').getConfig();
const npm = require('../../lib/datasource/npm');
const presetDefaults = require('../_fixtures/npm/renovate-config-default');

npm.getDependency = jest.fn(() => ({
  'renovate-config':
    presetDefaults.versions[presetDefaults['dist-tags'].latest][
      'renovate-config'
    ],
}));

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
      jest.mock('delay');
      require('delay').mockImplementation(() => Promise.resolve());
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
    it('supports forceCli', async () => {
      defaultArgv = defaultArgv.concat(['--force-cli=true']);
      const env = { GITHUB_TOKEN: 'abc' };
      await configParser.parseConfigs(env, defaultArgv);
    });
    it('autodiscovers github platform', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat([
        '--autodiscover',
        '--token=abc',
        '--pr-footer=custom',
      ]);
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
    /* These two tests do not work offline
    it('uses configured repositories when autodiscovery is to replacde it & logs warn', async () => {
      const env = {
        RENOVATE_CONFIG_FILE: require.resolve(
          '../_fixtures/config/file-with-repo-presets.js'
        ),
      };
      defaultArgv = defaultArgv.concat(['--autodiscover', '--token=abc']);
      ghGot.mockImplementationOnce(() => ({
        headers: {},
        body: [
          { full_name: 'bar/BAZ' },
          { full_name: 'renovatebot/renovate' },
          { full_name: 'not/configured' },
        ],
      }));
      const config = await configParser.parseConfigs(env, defaultArgv);
      expect(config.repositories.length).toBe(3);
      expect(
        config.repositories.map(
          repo => (typeof repo === 'string' ? repo : repo.repository)
        )
      ).toMatchSnapshot();
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
    it('resolves all presets', async () => {
      defaultArgv.push('--pr-hourly-limit=10', '--automerge=false');
      const env = {
        GITHUB_TOKEN: 'abc',
        RENOVATE_CONFIG_FILE: require.resolve(
          '../_fixtures/config/file-with-repo-presets.js'
        ),
      };
      ghGot.mockImplementationOnce(() =>
        Promise.resolve({
          headers: {},
          body: [],
        })
      );
      const actual = await configParser.parseConfigs(env, defaultArgv);
      expect(actual.separateMinorPatch).toBe(true);
      expect(actual.patch.automerge).toBe(true);
      expect(actual.minor.automerge).toBeUndefined();
      expect(actual.major.automerge).toBeUndefined();
      expect(actual.prHourlyLimit).toBe(10);
      expect(actual.automerge).toBe(false);
      actual.repositories.forEach(repo => {
        if (typeof repo === 'object') {
          expect(repo).toMatchSnapshot(repo.repository);
        }
      });
      delete actual.repositories;
      expect(actual).toMatchSnapshot('globalConfig');
    });
  */
  });
  describe('mergeChildConfig(parentConfig, childConfig)', () => {
    it('merges', () => {
      const parentConfig = { ...defaultConfig };
      const childConfig = {
        foo: 'bar',
        rangeStrategy: 'replace',
        lockFileMaintenance: {
          schedule: ['on monday'],
        },
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.foo).toEqual('bar');
      expect(config.rangeStrategy).toEqual('replace');
      expect(config.lockFileMaintenance.schedule).toEqual(['on monday']);
      expect(config.lockFileMaintenance).toMatchSnapshot();
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
