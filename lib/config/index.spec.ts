import { getConfig } from './defaults';
import { filterConfig, getManagerConfig, mergeChildConfig } from './index';

jest.mock('../modules/datasource/npm');
try {
  jest.mock('../../config.js');
} catch (err) {
  // file does not exist
}

const defaultConfig = getConfig();

describe('config/index', () => {
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
      const config = mergeChildConfig(parentConfig, childConfig);
      expect(config.foo).toBe('bar');
      expect(config.rangeStrategy).toBe('replace');
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
      const config = mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules.map((rule) => rule.a)).toMatchObject([
        1, 2, 3, 4,
      ]);
    });

    it('merges constraints', () => {
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
      const config = mergeChildConfig(parentConfig, childConfig);
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

    it('handles null child packageRules', () => {
      const parentConfig = { ...defaultConfig };
      parentConfig.packageRules = [{ a: 3 }, { a: 4 }];
      const config = mergeChildConfig(parentConfig, {});
      expect(config.packageRules).toHaveLength(2);
    });

    it('handles undefined childConfig', () => {
      const parentConfig = { ...defaultConfig };
      const config = mergeChildConfig(parentConfig, undefined);
      expect(config).toMatchObject(parentConfig);
    });

    it('getManagerConfig()', () => {
      const parentConfig = { ...defaultConfig };
      const config = getManagerConfig(parentConfig, 'npm');
      expect(config).toContainEntries([
        ['fileMatch', ['(^|/)package\\.json$']],
      ]);
      expect(getManagerConfig(parentConfig, 'html')).toContainEntries([
        ['fileMatch', ['\\.html?$']],
      ]);
    });

    it('filterConfig()', () => {
      const parentConfig = { ...defaultConfig };
      const config = filterConfig(parentConfig, 'pr');
      expect(config).toBeObject();
    });

    it('highest vulnerabilitySeverity maintained when config is vulnerability alert', () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        isVulnerabilityAlert: true,
        vulnerabilitySeverity: 'HIGH',
      });
      const childConfig = {
        vulnerabilitySeverity: 'CRITICAL',
      };
      const config = mergeChildConfig(parentConfig, childConfig);
      expect(config.vulnerabilitySeverity).toBe('CRITICAL');
    });
  });
});
