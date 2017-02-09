const argv = require('../_fixtures/config/argv');
const should = require('chai').should();

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser;
    let defaultArgv;
    beforeEach(() => {
      jest.resetModules();
      configParser = require('../../lib/config/index.js');
      defaultArgv = argv();
    });
    it('throws for no token', () => {
      const env = {};
      configParser.parseConfigs.bind(configParser, env, defaultArgv).should.throw('At least one repository must be configured');
    });
    it('supports token in env', () => {
      const env = { GITHUB_TOKEN: 'abc' };
      configParser.parseConfigs.bind(configParser, env, defaultArgv).should.throw('At least one repository must be configured');
    });
    it('supports token in CLI options', () => {
      const env = {};
      defaultArgv = defaultArgv.concat(['--token=abc']);
      configParser.parseConfigs.bind(configParser, env, defaultArgv).should.throw('At least one repository must be configured');
    });
    it('supports repositories in CLI', () => {
      const env = {};
      defaultArgv = defaultArgv.concat(['--token=abc', 'foo']);
      configParser.parseConfigs(env, defaultArgv);
      const repos = configParser.getRepositories();
      should.exist(repos);
      repos.should.have.length(1);
      repos[0].repository.should.eql('foo');
    });
    it('gets cascaded config', () => {
      const env = { RENOVATE_CONFIG_FILE: 'test/_fixtures/config/file.js' };
      configParser.parseConfigs(env, defaultArgv);
      const repo = configParser.getRepositories().pop();
      should.exist(repo);
      const cascadedConfig = configParser.getCascadedConfig(repo, null);
      should.exist(cascadedConfig.token);
      should.exist(cascadedConfig.recreateClosed);
    });
  });
});
