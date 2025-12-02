import type {
  GlobalOnlyConfig,
  RenovateConfig,
  RepoGlobalConfig,
} from './types';

export class GlobalConfig {
  static OPTIONS: readonly (keyof RepoGlobalConfig | keyof GlobalOnlyConfig)[] =
    [
      'allowCustomCrateRegistries',
      'allowPlugins',
      'allowScripts',
      'allowedCommands',
      'allowedEnv',
      'allowedHeaders',
      'allowedUnsafeExecutions',
      'autodiscover',
      'autodiscoverFilter',
      'autodiscoverNamespaces',
      'autodiscoverProjects',
      'autodiscoverRepoOrder',
      'autodiscoverRepoSort',
      'autodiscoverTopics',
      'baseDir',
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
      'deleteAdditionalConfigFile',
      'deleteConfigFile',
      'detectGlobalManagerConfig',
      'detectHostRulesFromEnv',
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
      'force',
      'forceCli',
      'forkCreation',
      'forkOrg',
      'forkToken',
      'gitNoVerify',
      'gitPrivateKey',
      'gitPrivateKeyPassphrase',
      'gitTimeout',
      'gitUrl',
      'githubTokenWarn',
      'globalExtends',
      'httpCacheTtlDays',
      'ignorePrAuthor',
      'includeMirrors',
      'inheritConfig',
      'inheritConfigFileName',
      'inheritConfigRepoName',
      'inheritConfigStrict',
      'logContext',
      'mergeConfidenceDatasources',
      'mergeConfidenceEndpoint',
      'migratePresets',
      'onboarding',
      'onboardingBranch',
      'onboardingCommitMessage',
      'onboardingConfig',
      'onboardingConfigFileName',
      'onboardingNoDeps',
      'onboardingPrTitle',
      'onboardingRebaseCheckbox',
      'optimizeForDisabled',
      'password',
      'persistRepoData',
      'platform',
      'prCommitsPerRunLimit',
      'presetCachePersistence',
      'privateKey',
      'privateKeyOld',
      'privateKeyPath',
      'privateKeyPathOld',
      'processEnv',
      'productLinks',
      'redisPrefix',
      'redisUrl',
      'reportPath',
      'reportType',
      'repositories',
      'repositoryCache',
      'repositoryCacheType',
      'requireConfig',
      's3Endpoint',
      's3PathStyle',
      'secrets',
      'token',
      'unicodeEmoji',
      'useCloudMetadataServices',
      'userAgent',
      'username',
      'variables',
      'writeDiscoveredRepos',
    ];

  private static config: RepoGlobalConfig = {};

  static get(): RepoGlobalConfig;
  static get<Key extends keyof RepoGlobalConfig>(
    key: Key,
  ): RepoGlobalConfig[Key];
  static get<Key extends keyof RepoGlobalConfig>(
    key: Key,
    defaultValue: Required<RepoGlobalConfig>[Key],
  ): Required<RepoGlobalConfig>[Key];
  static get<Key extends keyof RepoGlobalConfig>(
    key?: Key,
    defaultValue?: RepoGlobalConfig[Key],
  ): RepoGlobalConfig | RepoGlobalConfig[Key] {
    return key
      ? (GlobalConfig.config[key] ?? defaultValue)
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
