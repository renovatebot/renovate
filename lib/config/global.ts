import { globalConfigOptionDefaults } from '../global-config-option-defaults.generated.ts';
import type { RenovateConfig, RepoGlobalConfig } from './types.ts';

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
    'configValidationError',
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
    'forkCreation',
    'forkOrg',
    'forkToken',
    'gitTimeout',
    'githubTokenWarn',
    'httpCacheTtlDays',
    'ignorePrAuthor',
    'includeMirrors',
    'inheritConfig',
    'inheritConfigFileName',
    'inheritConfigRepoName',
    'inheritConfigStrict',
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
    'onboardingRebaseCheckbox',
    'optimizeForDisabled',
    'persistRepoData',
    'platform',
    'prCacheSyncMaxPages',
    'presetCachePersistence',
    'productLinks',
    'reportFormatting',
    'reportPath',
    'reportType',
    'repositoryCache',
    'repositoryCacheForceLocal',
    'repositoryCacheType',
    'requireConfig',
    's3Endpoint',
    's3PathStyle',
    'toolSettings',
    'unicodeEmoji',
    'userAgent',
  ];

  private static config: RepoGlobalConfig = {};

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

    return result;
  }

  static reset(): void {
    GlobalConfig.config = {};
  }
}
