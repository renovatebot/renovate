import { PLATFORM_TYPE_GITHUB } from '../constants/platforms';
import { getConfig } from './defaults';
import * as configMigration from './migration';
import { RenovateSharedConfig, RenovateConfig as _RenovateConfig } from '.';

const defaultConfig = getConfig();

interface RenovateConfig extends _RenovateConfig {
  node?: RenovateSharedConfig & { supportPolicy?: unknown };
}

describe('config/migration', () => {
  describe('migrateConfig(config, parentConfig)', () => {
    it('migrates config', () => {
      const config: RenovateConfig = {
        endpoints: [{}] as never,
        enabled: true,
        platform: PLATFORM_TYPE_GITHUB,
        hostRules: [
          {
            platform: 'docker',
            endpoint: 'https://docker.io',
            host: 'docker.io',
            username: 'some-username',
            password: 'some-password',
          },
        ],
        extends: [':js-app', 'config:library', ':masterIssue'],
        maintainYarnLock: true,
        onboarding: 'false' as never,
        multipleMajorPrs: true,
        gitFs: false,
        separateMajorReleases: true,
        separatePatchReleases: true,
        suppressNotifications: ['lockFileErrors', 'prEditNotification'],
        automerge: 'none' as never,
        automergeMajor: false,
        automergeMinor: true,
        automergePatch: true,
        masterIssue: 'true',
        masterIssueTitle: 'foo',
        gomodTidy: true,
        upgradeInRange: true,
        automergeType: 'branch-push',
        baseBranch: 'next',
        managerBranchPrefix: 'foo',
        branchPrefix: 'renovate/{{parentDir}}-',
        renovateFork: true,
        ignoreNodeModules: true,
        node: {
          enabled: true,
        },
        poetry: {
          rebaseStalePrs: true,
          versionScheme: 'pep440',
        },
        pipenv: {
          rebaseStalePrs: false,
          rebaseConflictedPrs: true,
        },
        pip_setup: {
          rebaseConflictedPrs: false,
        },
        rebaseStalePrs: null,
        rebaseConflictedPrs: true,
        meteor: true,
        autodiscover: 'true' as never,
        schedule: 'on the last day of the month' as never,
        commitMessage: '{{semanticPrefix}}some commit message',
        prTitle: '{{semanticPrefix}}some pr title',
        semanticPrefix: 'fix(deps): ',
        commitMessageExtra: '{{currentVersion}} something',
        pathRules: [
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
        peerDependencies: {
          versionStrategy: 'widen',
        },
        packageRules: [
          {
            packagePatterns: '^(@angular|typescript)' as never,
            groupName: ['angular packages'] as never,
            excludedPackageNames: 'foo',
          },
          {
            packagePatterns: ['^foo'],
            groupName: ['foo'] as never,
          },
          {
            packageName: 'angular',
            packagePattern: 'ang',
            enabled: false,
          },
          {
            packageNames: ['guava'],
            versionScheme: 'maven',
          },
        ],
        exposeEnv: true,
        lockFileMaintenance: {
          exposeEnv: false,
          gitFs: true,
          automerge: 'any' as never,
          schedule: 'before 5am every day' as never,
        },
        devDependencies: {
          automerge: 'minor',
          schedule: null,
        },
        nvmrc: {
          pathRules: [
            {
              paths: ['node/**'],
              extends: ['node'],
            },
          ],
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
        raiseDeprecationWarnings: false,
      };
      const parentConfig = { ...defaultConfig, semanticCommits: false };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(migratedConfig.depTypes).not.toBeDefined();
      expect(migratedConfig.automerge).toEqual(false);
      expect(migratedConfig.packageRules).toHaveLength(8);
      expect(migratedConfig.hostRules).toHaveLength(1);
    });
    it('migrates before and after schedules', () => {
      const config = {
        major: {
          schedule: 'after 10pm and before 7am' as never,
        },
        minor: {
          schedule: 'after 10pm and before 7am on every weekday' as never,
        },
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(migratedConfig.major.schedule).toHaveLength(2);
      expect(migratedConfig.major.schedule[0]).toEqual('after 10pm');
      expect(migratedConfig.major.schedule[1]).toEqual('before 7am');
      expect(migratedConfig.minor.schedule).toMatchSnapshot();
      expect(migratedConfig.minor.schedule).toHaveLength(2);
      expect(migratedConfig.minor.schedule[0]).toEqual(
        'after 10pm every weekday'
      );
      expect(migratedConfig.minor.schedule[1]).toEqual(
        'before 7am every weekday'
      );
    });
    it('migrates every friday', () => {
      const config = {
        schedule: 'every friday' as never,
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
      expect(migratedConfig.semanticCommitScope).toBeNull();
    });
    it('does not migrate every weekday', () => {
      const config = {
        schedule: 'every weekday' as never,
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
        schedule: 'after 5:00pm on wednesday and thursday' as never,
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
        schedule: 'after 1:00pm and before 5:00pm' as never,
      };
      const parentConfig = { ...defaultConfig };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        parentConfig
      );
      expect(migratedConfig.schedule).toEqual(config.schedule);
      expect(isMigrated).toBe(false);
    });
    it('migrates packages', () => {
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
    it('overrides existing automerge setting', () => {
      const config: RenovateConfig = {
        automerge: 'minor' as never,
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
    it('does not migrate config', () => {
      const config: RenovateConfig = {
        enabled: true,
        semanticCommits: true,
        separateMinorPatch: true,
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config
      );
      expect(isMigrated).toBe(false);
      expect(migratedConfig).toMatchObject(config);
    });
    it('migrates subconfig', () => {
      const config: RenovateConfig = {
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
      expect(migratedConfig.lockFileMaintenance.packageRules).toHaveLength(1);
      expect(
        migratedConfig.lockFileMaintenance.packageRules[0].respectLatest
      ).toBe(false);
    });
    it('migrates node to travis', () => {
      const config: RenovateConfig = {
        node: {
          enabled: true,
          supportPolicy: ['lts'],
          automerge: 'none' as never,
        },
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        defaultConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(
        (migratedConfig.node as RenovateSharedConfig).enabled
      ).toBeUndefined();
      expect((migratedConfig.travis as RenovateSharedConfig).enabled).toBe(
        true
      );
      expect(
        (migratedConfig.node as RenovateConfig).supportPolicy
      ).toBeDefined();
    });
    it('migrates packageFiles', () => {
      const config: RenovateConfig = {
        packageFiles: [
          'package.json',
          { packageFile: 'backend/package.json', pinVersions: false },
          { packageFile: 'frontend/package.json', pinVersions: true },
          {
            packageFile: 'other/package.json',
            devDependencies: { pinVersions: true },
            dependencies: { pinVersions: true },
          },
        ],
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        defaultConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(migratedConfig.includePaths).toHaveLength(4);
      expect(migratedConfig.packageFiles).toBeUndefined();
      expect(migratedConfig.packageRules).toHaveLength(4);
      expect(migratedConfig.packageRules[0].rangeStrategy).toBe('replace');
      expect(migratedConfig.packageRules[1].rangeStrategy).toBe('pin');
    });
    it('migrates more packageFiles', () => {
      const config: RenovateConfig = {
        packageFiles: [
          {
            packageFile: 'package.json',
            packageRules: [
              {
                pinVersions: true,
                depTypeList: ['devDependencies'],
              },
              {
                pinVersions: true,
                depTypeList: ['dependencies'],
              },
            ],
          },
        ],
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        defaultConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
      expect(migratedConfig.includePaths).toHaveLength(1);
      expect(migratedConfig.packageFiles).toBeUndefined();
      expect(migratedConfig.packageRules).toHaveLength(2);
    });

    it('removes invalid configs', () => {
      const config: RenovateConfig = {
        pathRules: {},
        packageFiles: [{ packageFile: 'test' }],
        gomodTidy: false,
        pinVersions: undefined,
        rebaseStalePrs: true,
        rebaseWhen: 'auto',
        exposeEnv: undefined,
        upgradeInRange: false,
        versionStrategy: undefined,
        ignoreNodeModules: undefined,
        baseBranch: [] as never,
        depTypes: [{}],
        commitMessage: 'test',
        raiseDeprecationWarnings: undefined,
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config,
        defaultConfig
      );
      expect(migratedConfig).toMatchSnapshot();
      expect(isMigrated).toBe(true);
    });
  });
});
