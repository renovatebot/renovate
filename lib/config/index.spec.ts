import getArgv from './config/__fixtures__/argv';
import { getConfig } from './defaults';

jest.mock('../datasource/npm');
try {
  jest.mock('../../config.js');
} catch (err) {
  // file does not exist
}

const defaultConfig = getConfig();

describe('config/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser: typeof import('.');
    let defaultArgv: string[];
    beforeEach(async () => {
      jest.resetModules();
      configParser = await import('./index');
      defaultArgv = getArgv();
      jest.mock('delay', () => Promise.resolve());
    });
    it('supports token in env', async () => {
      const env: NodeJS.ProcessEnv = { RENOVATE_TOKEN: 'abc' };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toMatchSnapshot();
    });
    it('supports token in CLI options', async () => {
      defaultArgv = defaultArgv.concat([
        '--token=abc',
        '--pr-footer=custom',
        '--log-context=abc123',
      ]);
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toMatchSnapshot();
    });
    it('supports forceCli', async () => {
      defaultArgv = defaultArgv.concat(['--force-cli=false']);
      const env: NodeJS.ProcessEnv = { RENOVATE_TOKEN: 'abc' };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toMatchSnapshot();
    });
    it('supports Bitbucket username/passwod', async () => {
      defaultArgv = defaultArgv.concat([
        '--platform=bitbucket',
        '--username=user',
        '--password=pass',
      ]);
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toMatchSnapshot();
    });
    it('massages trailing slash into endpoint', async () => {
      defaultArgv = defaultArgv.concat([
        '--endpoint=https://github.renovatebot.com/api/v3',
      ]);
      const env: NodeJS.ProcessEnv = {};
      const parsed = await configParser.parseConfigs(env, defaultArgv);
      expect(parsed.endpoint).toEqual('https://github.renovatebot.com/api/v3/');
    });
  });
  describe('mergeChildConfig(parentConfig, childConfig)', () => {
    it('merges', async () => {
      const parentConfig = { ...defaultConfig };
      const childConfig = {
        foo: 'bar',
        rangeStrategy: 'replace',
        lockFileMaintenance: {
          schedule: ['on monday'],
        },
      };
      const configParser = await import('./index');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.foo).toEqual('bar');
      expect(config.rangeStrategy).toEqual('replace');
      expect(config.lockFileMaintenance.schedule).toEqual(['on monday']);
      expect(config.lockFileMaintenance).toMatchSnapshot();
    });
    it('merges packageRules', async () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        packageRules: [{ a: 1 }, { a: 2 }],
      });
      const childConfig = {
        packageRules: [{ a: 3 }, { a: 4 }],
      };
      const configParser = await import('./index');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules.map((rule) => rule.a)).toMatchObject([
        1,
        2,
        3,
        4,
      ]);
    });
    it('handles null parent packageRules', async () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        packageRules: null,
      });
      const childConfig = {
        packageRules: [{ a: 3 }, { a: 4 }],
      };
      const configParser = await import('./index');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules).toHaveLength(2);
    });
    it('handles null child packageRules', async () => {
      const parentConfig = { ...defaultConfig };
      parentConfig.packageRules = [{ a: 3 }, { a: 4 }];
      const configParser = await import('./index');
      const config = configParser.mergeChildConfig(parentConfig, {});
      expect(config.packageRules).toHaveLength(2);
    });
    it('handles undefined childConfig', async () => {
      const parentConfig = { ...defaultConfig };
      const configParser = await import('./index');
      const config = configParser.mergeChildConfig(parentConfig, undefined);
      expect(config).toMatchObject(parentConfig);
    });

    it('getManagerConfig()', async () => {
      const parentConfig = { ...defaultConfig };
      const configParser = await import('./index');
      const config = configParser.getManagerConfig(parentConfig, 'npm');
      expect(config).toMatchSnapshot();
      expect(
        configParser.getManagerConfig(parentConfig, 'html')
      ).toMatchSnapshot();
    });

    it('filterConfig()', async () => {
      const parentConfig = { ...defaultConfig };
      const configParser = await import('./index');
      const config = configParser.filterConfig(parentConfig, 'pr');
      expect(config).toMatchSnapshot();
    });
  });
});
