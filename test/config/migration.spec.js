const configMigration = require('../../lib/config/migration.js');
const defaultConfig = require('../../lib/config/defaults').getConfig();

describe('config/migration', () => {
  describe('migrateConfig(config, parentConfig)', () => {
    it('it migrates config', () => {
      const config = {
        enabled: true,
        extends: [':js-app', 'config:library'],
        maintainYarnLock: true,
        onboarding: 'false',
        automerge: 'none',
        automergeMajor: false,
        automergeMinor: true,
        automergePatch: true,
        baseBranch: 'next',
        ignoreNodeModules: true,
        node: {
          enabled: true,
        },
        meteor: true,
        autodiscover: 'true',
        schedule: 'on the last day of the month',
        commitMessage: '{{semanticPrefix}}some commit message',
        prTitle: '{{semanticPrefix}}some pr title',
        semanticPrefix: 'fix(deps): ',
        packageRules: [
          {
            packagePatterns: '^(@angular|typescript)',
            groupName: ['angular packages'],
            excludedPackageNames: 'foo',
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
        lockFileMaintenance: {
          automerge: 'any',
          schedule: 'before 5am every day',
        },
        devDependencies: {
          automerge: 'minor',
          schedule: null,
        },
        depTypes: [
          'dependencies',
          {
            depType: 'optionalDependencies',
            respectLatest: false,
            automerge: 'minor',
            schedule: 'before 5am on Mondays',
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
    it('migrates before and after schedules', () => {
      const config = {
        dependencies: {
          schedule: 'after 10pm and before 7am',
        },
        devDependencies: {
          schedule: 'after 10pm and before 7am on every weekday',
        },
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(migratedConfig.dependencies.schedule.length).toBe(2);
      expect(migratedConfig.dependencies.schedule[0]).toEqual('after 10pm');
      expect(migratedConfig.dependencies.schedule[1]).toEqual('before 7am');
      expect(migratedConfig.devDependencies.schedule).toMatchSnapshot();
      expect(migratedConfig.devDependencies.schedule.length).toBe(2);
      expect(migratedConfig.devDependencies.schedule[0]).toEqual(
        'after 10pm every weekday'
      );
      expect(migratedConfig.devDependencies.schedule[1]).toEqual(
        'before 7am every weekday'
      );
    });
    it('migrates every friday', () => {
      const config = {
        schedule: 'every friday',
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(isMigrated).toBe(true);
      expect(migratedConfig.schedule).toEqual('on friday');
    });
    it('migrates semantic prefix with no scope', () => {
      const config = {
        semanticPrefix: 'fix',
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(isMigrated).toBe(true);
      expect(migratedConfig.semanticCommitScope).toBe(null);
    });
    it('does not migrate every weekday', () => {
      const config = {
        schedule: 'every weekday',
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(isMigrated).toBe(false);
      expect(migratedConfig.schedule).toEqual(config.schedule);
    });
    it('does not migrate multi days', () => {
      const config = {
        schedule: 'after 5:00pm on wednesday and thursday',
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(false);
      expect(migratedConfig.schedule).toEqual(config.schedule);
    });
    it('does not migrate hour range', () => {
      const config = {
        schedule: 'after 1:00pm and before 5:00pm',
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(migratedConfig.schedule).toEqual(config.schedule);
      expect(isMigrated).toBe(false);
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
    it('it overrides existing automerge setting', () => {
      const config = {
        automerge: 'minor',
        packages: [
          {
            packagePatterns: '^(@angular|typescript)',
            automerge: 'patch',
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
      expect(migratedConfig.packageRules[0].minor.automerge).toBe(false);
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
    it('it migrates node to travis', () => {
      const config = {
        node: {
          enabled: true,
          supportPolicy: ['lts'],
          automerge: 'none',
        },
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        defaultConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(migratedConfig.node.enabled).toBeUndefined();
      expect(migratedConfig.travis.enabled).toBe(true);
      expect(migratedConfig.node.supportPolicy).toBeDefined();
    });
  });
});
