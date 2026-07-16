import { globalConfigOptionDefaults } from '../global-config-option-defaults.generated.ts';
import type { PackageRule, RenovateConfig, RepoGlobalConfig } from './types.ts';

export class GlobalConfig {
  // TODO: once global config work is complete, add a test to make sure this list includes all options with globalOnly=true (#9603)
  static OPTIONS: readonly (keyof RepoGlobalConfig)[] = [
    'allowCustomCrateRegistries',
    'allowPlugins',
    'allowScripts',
    'allowShellExecutorForPostUpgradeCommands',
    'allowedCommands',
    'allowedEnv',
    'allowedHeaders',
    'allowedUnsafeExecutions',
    'autodiscoverRepoOrder',
    'autodiscoverRepoSort',
    'bbUseDevelopmentBranch',
    'binarySource',
    'cacheDir',
    'cacheHardTtlMinutes',
    'cachePrivatePackages',
    'cacheTtlOverride',
    'checkedBranches',
    'configFileNames',
    'containerbaseDir',
    'customEnvVariables',
    'dockerChildPrefix',
    'dockerCliOptions',
    'dockerMaxPages',
    'dockerSidecarImage',
    'dockerUser',
    'dryRun',
    'encryptedWarning',
    'endpoint',
    'executionTimeout',
    'exposeAllEnv',
    'gitTimeout',
    'githubTokenWarn',
    'httpCacheTtlDays',
    'ignorePrAuthor',
    'includeMirrors',
    'localDir',
    'migratePresets',
    'onboarding',
    'onboardingAutoCloseAge',
    'onboardingBranch',
    'onboardingCommitMessage',
    'onboardingConfig',
    'onboardingConfigFileName',
    'onboardingNoDeps',
    'onboardingPrTitle',
    'platform',
    'prCacheSyncMaxPages',
    'presetCachePersistence',
    'productLinks',
    'rebaseAllOpenBranches',
    'repositoryCacheForceLocal',
    'requireConfig',
    's3Endpoint',
    's3PathStyle',
    'toolSettings',
    'userAgent',
  ];

  private static config: RepoGlobalConfig = {};

  // `packageRules` is not a globalOnly option, so it's not part of `OPTIONS`/`config` above
  // (which are stripped out of the repo config once captured). It's mirrored here so
  // low-level util code without access to the repo config, e.g. `util/exec/containerbase.ts`,
  // can still consult the current repository's package rules.
  private static toolPackageRules: PackageRule[] = [];

  static get(): RepoGlobalConfig;
  static get<Key extends keyof RepoGlobalConfig>(
    key: Key,
  ): Required<RepoGlobalConfig>[Key];
  static get<Key extends keyof RepoGlobalConfig>(
    key: Key,
  ): Required<RepoGlobalConfig>[Key];
  static get<Key extends keyof RepoGlobalConfig>(
    key?: Key,
  ): RepoGlobalConfig | Required<RepoGlobalConfig>[Key] {
    const defaultValue = key
      ? (globalConfigOptionDefaults[key] as Required<RepoGlobalConfig>[Key])
      : undefined;

    return key
      ? ((GlobalConfig.config[key] ??
          defaultValue) as Required<RepoGlobalConfig>[Key])
      : GlobalConfig.config;
  }

  static set(config: RenovateConfig & RepoGlobalConfig): RenovateConfig {
    GlobalConfig.reset();

    const result = { ...config };
    for (const option of GlobalConfig.OPTIONS) {
      GlobalConfig.config[option] = config[option] as never;
      delete result[option];
    }
    GlobalConfig.toolPackageRules = config.packageRules ?? [];

    return result;
  }

  static reset(): void {
    GlobalConfig.config = {};
    GlobalConfig.toolPackageRules = [];
  }

  static getPackageRules(): PackageRule[] {
    return GlobalConfig.toolPackageRules;
  }
}
