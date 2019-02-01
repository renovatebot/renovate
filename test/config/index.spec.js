const argv = require('../_fixtures/config/argv');
const defaultConfig = require('../../lib/config/defaults').getConfig();
const npm = require('../../lib/datasource/npm');
const presetDefaults = require('../_fixtures/npm/renovate-config-default');

npm.getPkgReleases = jest.fn(() => ({
  'renovate-config':
    presetDefaults.versions[presetDefaults['dist-tags'].latest][
      'renovate-config'
    ],
}));

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser;
    let defaultArgv;
    beforeEach(() => {
      jest.resetModules();
      configParser = require('../../lib/config/index.js');
      defaultArgv = argv();
      jest.mock('delay');
      require('delay').mockImplementation(() => Promise.resolve());
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
      expect(err.message).toBe(
        'No authentication found for platform https://api.github.com/ (github)'
      );
    });
    it('throws for no GitLab token', async () => {
      const env = { RENOVATE_PLATFORM: 'gitlab' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'No authentication found for platform https://gitlab.com/api/v4/ (gitlab)'
      );
    });
    it('throws for no Azure DevOps token', async () => {
      const env = { RENOVATE_PLATFORM: 'azure' };
      let err;
      try {
        await configParser.parseConfigs(env, defaultArgv);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'No authentication found for platform undefined (azure)'
      );
    });
    it('supports token in env', async () => {
      const env = { RENOVATE_TOKEN: 'abc' };
      await configParser.parseConfigs(env, defaultArgv);
    });
    it('supports token in CLI options', async () => {
      defaultArgv = defaultArgv.concat(['--token=abc', '--pr-footer=custom']);
      const env = {};
      await configParser.parseConfigs(env, defaultArgv);
    });
    it('supports forceCli', async () => {
      defaultArgv = defaultArgv.concat(['--force-cli=true']);
      const env = { RENOVATE_TOKEN: 'abc' };
      await configParser.parseConfigs(env, defaultArgv);
    });
    it('supports Bitbucket username/passwod', async () => {
      defaultArgv = defaultArgv.concat([
        '--platform=bitbucket',
        '--username=user',
        '--password=pass',
      ]);
      const env = {};
      await configParser.parseConfigs(env, defaultArgv);
    });
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
