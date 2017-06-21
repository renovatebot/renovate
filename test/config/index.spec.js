const argv = require('../_fixtures/config/argv');

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser;
    let defaultArgv;
    let ghGot;
    let glGot;
    let githubAppHelper;
    beforeEach(() => {
      jest.resetModules();
      configParser = require('../../lib/config/index.js');
      defaultArgv = argv();
      jest.mock('gh-got');
      ghGot = require('gh-got');
      jest.mock('gl-got');
      glGot = require('gl-got');
      jest.mock('../../lib/helpers/github-app');
      githubAppHelper = require('../../lib/helpers/github-app');
      githubAppHelper.getRepositories = jest.fn();
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
      githubAppHelper.getRepositories.mockImplementationOnce(() => {
        const result = [
          {
            repository: 'a/b',
            token: 'token_a',
          },
        ];
        return result;
      });
      await configParser.parseConfigs(env, defaultArgv);
      expect(githubAppHelper.getRepositories.mock.calls.length).toBe(1);
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
  describe('.getRepoConfig(config, index)', () => {
    let configParser;
    beforeEach(() => {
      configParser = require('../../lib/config/index.js');
    });
    const config = {
      global: 'b',
      repositories: [
        'c/d',
        {
          repository: 'e/f',
          repoField: 'g',
        },
      ],
    };
    it('massages string repos', () => {
      expect(configParser.getRepoConfig(config, 0)).toMatchSnapshot();
    });
    it('handles object repos', () => {
      expect(configParser.getRepoConfig(config, 1)).toMatchSnapshot();
    });
  });
});
