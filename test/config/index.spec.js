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
    it('throws for no token', async () => {
      const env = {};
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('At least one repository must be configured');
    });
    it('supports token in env', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('At least one repository must be configured');
    });
    it('supports token in CLI options', async () => {
      defaultArgv = defaultArgv.concat(['--token=abc']);
      const env = { GITHUB_TOKEN: 'abc' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('At least one repository must be configured');
    });
    it('autodiscovers github platform', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      defaultArgv = defaultArgv.concat(['--autodiscover']);
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
      const env = { GITLAB_TOKEN: 'abc' };
      defaultArgv = defaultArgv.concat(['--autodiscover', '--platform=gitlab']);
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
    it('errors for unknown platform', async () => {
      const env = { GITHUB_TOKEN: 'abc' };
      defaultArgv = defaultArgv.concat(['--autodiscover', '--platform=foo']);
      await configParser.parseConfigs(env, defaultArgv);
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
