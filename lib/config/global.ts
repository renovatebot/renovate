import type { RenovateConfig, RepoGlobalConfig } from './types';

export class GlobalConfig {
  // TODO: once global config work is complete, add a test to make sure this list includes all options with globalOnly=true (#9603)
  private static readonly OPTIONS: (keyof RepoGlobalConfig)[] = [
    'allowedCommands',
    'allowedEnv',
    'allowCustomCrateRegistries',
    'allowedHeaders',
    'allowPlugins',
    'allowScripts',
    'autodiscoverRepoSort',
    'autodiscoverRepoOrder',
    'binarySource',
    'cacheDir',
    'cacheHardTtlMinutes',
    'cachePrivatePackages',
    'cacheTtlOverride',
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
    'exposeAllEnv',
    'executionTimeout',
    'githubTokenWarn',
    'gitTimeout',
    'httpCacheTtlDays',
    'ignorePrAuthor',
    'includeMirrors',
    'localDir',
    'migratePresets',
    'platform',
    'presetCachePersistence',
    's3Endpoint',
    's3PathStyle',
    'userAgent',
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
