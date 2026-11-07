import * as datasource from '../modules/datasource/index.ts';
import { getConfig } from './defaults.ts';
import {
  applyDatasourceDefaultConfig,
  filterConfig,
  getManagerConfig,
  mergeChildConfig,
  removeGlobalConfig,
} from './index.ts';
import type { RenovateConfig } from './types.ts';

vi.mock('../modules/datasource/npm/index.ts');
vi.mock('../../config.ts', () => ({ default: {} }));

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
      expect(config.lockFileMaintenance).toMatchObject({
        branchTopic: 'lock-file-maintenance',
        enabled: false,
        schedule: ['on monday'],
      });
    });

    it('merges packageRules', () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        packageRules: [
          { matchPackageNames: ['pkg1'] },
          { matchPackageNames: ['pkg2'] },
        ],
      });
      const childConfig = {
        packageRules: [
          { matchPackageNames: ['pkg3'] },
          { matchPackageNames: ['pkg4'] },
        ],
      };
      const config = mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules).toMatchObject([
        { matchPackageNames: ['pkg1'] },
        { matchPackageNames: ['pkg2'] },
        { matchPackageNames: ['pkg3'] },
        { matchPackageNames: ['pkg4'] },
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
      expect(config.constraints).toEqual({
        node: '<15',
        npm: '^6.0.0',
      });
    });

    it('merges forced options', () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        force: {
          schedule: 'at any time',
        },
      });
      const childConfig = {
        force: {
          constraints: {
            node: '<15',
          },
        },
      };
      const config = mergeChildConfig(parentConfig, childConfig);
      expect(config.force.schedule).toBe('at any time');
      expect(config.force.constraints.node).toBe('<15');
    });

    it('handles null parent packageRules', async () => {
      const parentConfig = { ...defaultConfig };
      Object.assign(parentConfig, {
        packageRules: null,
      });
      const childConfig = {
        packageRules: [{ a: 3 }, { a: 4 }],
      };
      const configParser = await import('./index.ts');
      const config = configParser.mergeChildConfig(parentConfig, childConfig);
      expect(config.packageRules).toHaveLength(2);
    });

    it('handles null child packageRules', () => {
      const parentConfig = { ...defaultConfig };
      parentConfig.packageRules = [
        { matchPackageNames: ['pkg1'] },
        { matchPackageNames: ['pkg2'] },
      ];
      const config = mergeChildConfig(parentConfig, {});
      expect(config.packageRules).toMatchObject([
        { matchPackageNames: ['pkg1'] },
        { matchPackageNames: ['pkg2'] },
      ]);
    });

    describe('an option set to null', () => {
      it.each`
        name               | value         | expected
        ${'enabled'}       | ${false}      | ${true}
        ${'rangeStrategy'} | ${'pin'}      | ${'auto'}
        ${'labels'}        | ${['foo']}    | ${[]}
        ${'platform'}      | ${'gitlab'}   | ${'github'}
        ${'gitNoVerify'}   | ${['commit']} | ${['commit', 'push']}
      `(
        'gives $name its default over a value of the parent',
        ({ name, value, expected }) => {
          const parentConfig: Record<string, unknown> = { [name]: value };

          const config = mergeChildConfig(parentConfig, { [name]: null });

          expect(config[name]).toEqual(expected);
        },
      );

      it('gives an option its default when it is forced', () => {
        const parentConfig: Record<string, unknown> = {
          automergeType: 'branch',
        };

        const config = mergeChildConfig(parentConfig, {
          force: { automergeType: null },
        });

        expect(config.automergeType).toBe('pr');
      });

      it('keeps null where the parent has no value', () => {
        const config = mergeChildConfig({}, { rangeStrategy: null });

        expect(config).toEqual({ rangeStrategy: null });
      });

      it('gives the default once the config is merged over one with a value', () => {
        const presetConfig: Record<string, unknown> = mergeChildConfig(
          {},
          { rangeStrategy: null },
        );

        const config = mergeChildConfig({ rangeStrategy: 'pin' }, presetConfig);

        expect(config.rangeStrategy).toBe('auto');
      });

      it.each`
        name                            | description
        ${'groupName'}                  | ${'has a null default'}
        ${'composerIgnorePlatformReqs'} | ${'is nullable'}
        ${'commitMessageTopic'}         | ${'is nullable'}
        ${'matchPackageNames'}          | ${'is not a top-level option'}
        ${'npm'}                        | ${'is a manager config'}
      `('keeps null for an option which $description', ({ name }) => {
        const parentConfig: Record<string, unknown> = { [name]: 'value' };

        const config = mergeChildConfig(parentConfig, { [name]: null });

        expect(config[name]).toBeNull();
      });

      it('keeps null within a mergeable option until it is merged into the config', () => {
        const parentConfig: Record<string, unknown> = {
          automerge: true,
          major: { automerge: true },
        };

        const config = mergeChildConfig(parentConfig, {
          major: { automerge: null },
        });
        const majorConfig = mergeChildConfig(config, config.major);

        expect(config.major).toEqual({ automerge: null });
        expect(majorConfig.automerge).toBeFalse();
      });
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
        [
          'managerFilePatterns',
          [
            '/(^|/)package\\.json$/',
            '/(^|/)pnpm-workspace\\.yaml$/',
            '/(^|/)\\.yarnrc\\.yml$/',
          ],
        ],
      ]);
      expect(getManagerConfig(parentConfig, 'html')).toContainEntries([
        ['managerFilePatterns', ['/\\.html?$/']],
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

  describe('applyDatasourceDefaultConfig()', () => {
    it('lets the datasource defaults win over the given config', async () => {
      vi.spyOn(datasource, 'getDefaultConfig').mockResolvedValueOnce({
        commitMessageTopic: 'Dummy {{depName}}',
      });

      const res = await applyDatasourceDefaultConfig({
        datasource: 'dummy',
        packageName: 'package',
        commitMessageTopic: 'dependency {{depName}}',
      });

      expect(res).toEqual({
        datasource: 'dummy',
        packageName: 'package',
        commitMessageTopic: 'Dummy {{depName}}',
      });
    });

    it('keeps the config as-is for a datasource without defaults', async () => {
      vi.spyOn(datasource, 'getDefaultConfig').mockResolvedValueOnce({});

      const res = await applyDatasourceDefaultConfig({
        datasource: 'dummy',
        packageName: 'package',
      });

      expect(res).toEqual({ datasource: 'dummy', packageName: 'package' });
    });

    it('keeps the config as-is without a datasource', async () => {
      const getDefaultConfig = vi.spyOn(datasource, 'getDefaultConfig');
      const config: RenovateConfig = { depName: 'dep' };

      const res = await applyDatasourceDefaultConfig(config);

      expect(res).toEqual({ depName: 'dep' });
      expect(getDefaultConfig).not.toHaveBeenCalled();
    });
  });

  describe('removeGlobalConfig()', () => {
    it('removes all global config', () => {
      const filteredConfig = removeGlobalConfig(defaultConfig, false);
      expect(filteredConfig).not.toHaveProperty('onboarding');
      expect(filteredConfig).not.toHaveProperty('binarySource');
      expect(filteredConfig.prHourlyLimit).toBe(2);
    });

    it('retains inherited config', () => {
      const filteredConfig = removeGlobalConfig(defaultConfig, true);
      expect(filteredConfig).toHaveProperty('onboarding');
      expect(filteredConfig).not.toHaveProperty('binarySource');
      expect(filteredConfig.prHourlyLimit).toBe(2);
    });
  });
});
