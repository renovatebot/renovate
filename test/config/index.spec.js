const argv = require('../_fixtures/config/argv');
const defaultConfig = require('../../lib/config/defaults').getConfig();

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser;
    let defaultArgv;
    let ghGot;
    let glGot;
    let githubApp;
    beforeEach(() => {
      jest.resetModules();
      configParser = require('../../lib/config/index.js');
      defaultArgv = argv();
      jest.mock('gh-got');
      ghGot = require('gh-got');
      jest.mock('gl-got');
      glGot = require('gl-got');
      jest.mock('../../lib/config/github-app');
      githubApp = require('../../lib/config/github-app');
      githubApp.getRepositories = jest.fn();
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
    it('supports token in env', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'At least one repository must be configured, or use --autodiscover'
      );
    });
    it('supports token in CLI options', async () => {
      defaultArgv = defaultArgv.concat(['--token=abc']);
      const env = {};
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'At least one repository must be configured, or use --autodiscover'
      );
    });
    it('throws if no GitHub App key defined', async () => {
      defaultArgv = defaultArgv.concat(['--github-app-id=5']);
      const env = {};
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('A GitHub App Private Key must be provided');
    });
    it('supports github app', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat([
        '--github-app-id=5',
        '--github-app-key=abc',
      ]);
      githubApp.getRepositories.mockImplementationOnce(() => {
        const result = [
          {
            repository: 'a/b',
            token: 'token_a',
          },
        ];
        return result;
      });
      await configParser.parseConfigs(env, defaultArgv);
      expect(githubApp.getRepositories.mock.calls.length).toBe(1);
    });
    it('autodiscovers github platform', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat(['--autodiscover', '--token=abc']);
      ghGot.mockImplementationOnce(() => ({
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
      expect(glGot.mock.calls.length).toBe(0);
    });
    it('autodiscovers gitlab platform', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat([
        '--autodiscover',
        '--platform=gitlab',
        '--token=abc',
      ]);
      glGot.mockImplementationOnce(() => ({
        body: [
          {
            path_with_namespace: 'a/b',
          },
        ],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(0);
      expect(glGot.mock.calls.length).toBe(1);
    });
    it('logs if no autodiscovered repositories', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      defaultArgv = defaultArgv.concat(['--autodiscover']);
      ghGot.mockImplementationOnce(() => ({
        body: [],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(1);
      expect(glGot.mock.calls.length).toBe(0);
    });
    it('adds a log file', async () => {
      const env = { GITHUB_TOKEN: 'abc', RENOVATE_LOG_FILE: 'debug.log' };
      defaultArgv = defaultArgv.concat(['--autodiscover']);
      ghGot.mockImplementationOnce(() => ({
        body: [],
      }));
      await configParser.parseConfigs(env, defaultArgv);
      expect(ghGot.mock.calls.length).toBe(1);
      expect(glGot.mock.calls.length).toBe(0);
    });
  });
  describe('mergeChildConfig(parentConfig, childConfig)', () => {
    it('merges', () => {
      const parentConfig = Object.assign({}, defaultConfig);
      const childConfig = {
        foo: 'bar',
        pinVersions: false,
        lockFileMaintenance: {
          schedule: 'on monday',
        },
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.foo).toEqual('bar');
      expect(config.pinVersions).toBe(false);
      expect(config.lockFileMaintenance.schedule).toEqual('on monday');
      expect(config.lockFileMaintenance).toMatchSnapshot();
    });
    it('merges depTypes with no child config', () => {
      const parentConfig = Object.assign({}, defaultConfig);
      const childConfig = {
        depTypes: ['dependencies'],
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.depTypes).toMatchSnapshot();
    });
    it('merges depTypes with meaningful child', () => {
      const parentConfig = Object.assign({}, defaultConfig);
      const childConfig = {
        depTypes: [
          'dependencies',
          {
            depType: 'devDependencies',
            foo: 1,
          },
          'peerDependencies',
        ],
      };
      const configParser = require('../../lib/config/index.js');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.depTypes).toMatchSnapshot();
    });
  });
});
