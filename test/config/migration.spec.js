const configMigration = require('../../lib/config/migration.js');
const defaultConfig = require('../../lib/config/defaults').getConfig();

describe('config/migration', () => {
  describe('migrateConfig(config, parentConfig)', () => {
    it('it migrates config', () => {
      const config = {
        enabled: true,
        maintainYarnLock: true,
        onboarding: 'false',
        automerge: 'none',
        autodiscover: 'true',
        schedule: ['on the last day of the month'],
        commitMessage: '{{semanticPrefix}}some commit message',
        prTitle: '{{semanticPrefix}}some pr title',
        semanticPrefix: 'fix(deps): ',
        semanticCommits: false,
        packageRules: [
          {
            packagePatterns: '^(@angular|typescript)',
            groupName: ['angular packages'],
          },
          {
            packagePatterns: ['^foo'],
            groupName: ['foo'],
          },
          {
            packageName: 'angular',
            packagePattern: 'ang',
            enabled: false,
          },
        ],
        lockFileConfig: {
          automerge: 'any',
        },
        devDependencies: {
          automerge: 'minor',
        },
        depTypes: [
          'dependencies',
          {
            depType: 'optionalDependencies',
            respectLatest: false,
          },
        ],
      };
      const parentConfig = { ...defaultConfig, semanticCommits: false };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(isMigrated).toBe(true);
      expect(migratedConfig.depTypes).not.toBeDefined();
      expect(migratedConfig.optionalDependencies.respectLatest).toBe(false);
      expect(migratedConfig.automerge).toEqual(false);
      expect(migratedConfig).toMatchSnapshot();
    });
    it('it migrates packages', () => {
      const config = {
        packages: [
          {
            packagePatterns: '^(@angular|typescript)',
            groupName: ['angular packages'],
          },
        ],
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(isMigrated).toBe(true);
      expect(migratedConfig).toMatchSnapshot();
    });
    it('it does not migrate config', () => {
      const config = {
        enabled: true,
        semanticCommits: true,
        separatePatchReleases: true,
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config
      );
      expect(isMigrated).toBe(false);
      expect(migratedConfig).toMatchObject(config);
    });
    it('it migrates subconfig', () => {
      const config = {
        lockFileMaintenance: {
          depTypes: [
            'dependencies',
            {
              depType: 'optionalDependencies',
              respectLatest: false,
            },
          ],
        },
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        defaultConfig
      );
      expect(isMigrated).toBe(true);
      expect(migratedConfig).toMatchSnapshot();
      expect(migratedConfig.lockFileMaintenance.depTypes).not.toBeDefined();
      expect(
        migratedConfig.lockFileMaintenance.optionalDependencies.respectLatest
      ).toBe(false);
    });
  });
});
