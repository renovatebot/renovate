const argv = require('../_fixtures/config/argv');
const should = require('chai').should();

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser;
    let defaultArgv;
    let ghGot;
    let glGot;
    beforeEach(() => {
      jest.resetModules();
      configParser = require('../../lib/config/index.js');
      defaultArgv = argv();
      jest.mock('gh-got');
      jest.mock('gl-got');
      ghGot = require('gh-got');
      glGot = require('gl-got');
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
        'At least one repository must be configured, or use --autodiscover',
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
        'At least one repository must be configured, or use --autodiscover',
      );
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
    it('supports repositories in CLI', async () => {
      const env = {};
      defaultArgv = defaultArgv.concat(['--token=abc', 'foo']);
      await configParser.parseConfigs(env, defaultArgv);
      const repos = configParser.getRepositories();
      should.exist(repos);
      repos.should.have.length(1);
      repos[0].repository.should.eql('foo');
    });
    it('gets cascaded config', async () => {
      const env = { RENOVATE_CONFIG_FILE: 'test/_fixtures/config/file.js' };
      await configParser.parseConfigs(env, defaultArgv);
      const repo = configParser.getRepositories().pop();
      should.exist(repo);
      const cascadedConfig = configParser.getCascadedConfig(repo, null);
      should.exist(cascadedConfig.token);
      should.exist(cascadedConfig.recreateClosed);
    });
  });
});
