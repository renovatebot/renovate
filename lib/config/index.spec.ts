import { getConfig } from './defaults';

jest.mock('../modules/datasource/npm');
try {
  jest.mock('../../config.js');
} catch (err) {
  // file does not exist
}

const defaultConfig = getConfig();

describe('config/index', () => {
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
      expect(config.foo).toBe('bar');
      expect(config.rangeStrategy).toBe('replace');
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
        1, 2, 3, 4,
      ]);
    });

    it('merges constraints', async () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        constraints: {
          node: '>=12',
          npm: '^6.0.0',
        },
      });
      const childConfig = {
        constraints: {
          node: '<15',
        },
      };
      const configParser = await import('./index');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.constraints).toMatchSnapshot();
      expect(config.constraints.node).toBe('<15');
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
      expect(config).toContainEntries([
        ['fileMatch', ['(^|/)package\\.json$']],
        ['rollbackPrs', true],
      ]);
      expect(
        configParser.getManagerConfig(parentConfig, 'html')
      ).toContainEntries([['fileMatch', ['\\.html?$']]]);
    });

    it('filterConfig()', async () => {
      const parentConfig = { ...defaultConfig };
      const configParser = await import('./index');
      const config = configParser.filterConfig(parentConfig, 'pr');
      expect(config).toBeObject();
    });
  });
});
