import type { RenovateConfig, RepoGlobalConfig } from './types';

export class GlobalConfig {
  // TODO: once global config work is complete, add a test to make sure this list includes all options with globalOnly=true (#9603)
  private static readonly OPTIONS: (keyof RepoGlobalConfig)[] = [
    'allowedEnv',
    'allowCustomCrateRegistries',
    'allowedHeaders',
    'allowedPostUpgradeCommands',
    'allowPlugins',
    'allowPostUpgradeCommandTemplating',
    'allowScripts',
    'binarySource',
    'cacheDir',
    'cacheHardTtlMinutes',
    'cacheTtlOverride',
    'containerbaseDir',
    'customEnvVariables',
    'dockerChildPrefix',
    'dockerCliOptions',
    'dockerSidecarImage',
    'dockerUser',
    'dryRun',
    'exposeAllEnv',
    'executionTimeout',
    'githubTokenWarn',
    'localDir',
    'migratePresets',
    'presetCachePersistence',
    'privateKey',
    'privateKeyOld',
    'gitTimeout',
    'platform',
    'endpoint',
    'experimentalFlags',
    'httpCacheTtlDays',
  ];

  private static config: RepoGlobalConfig = {};
  private static parsedExperimentalFlags: Set<string> = new Set();

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
    return key ? GlobalConfig.config[key] ?? defaultValue : GlobalConfig.config;
  }

  static set(config: RenovateConfig | RepoGlobalConfig): RenovateConfig {
    GlobalConfig.reset();

    const result = { ...config };
    for (const option of GlobalConfig.OPTIONS) {
      GlobalConfig.config[option] = config[option] as never;
      delete result[option];
    }

    return result;
  }

  static getExperimentalFlag(key: string): boolean {
    const experimentalFlags = GlobalConfig.get('experimentalFlags');

    if (!experimentalFlags) {
      return false;
    }

    if (!GlobalConfig.parsedExperimentalFlags.size) {
      GlobalConfig.parsedExperimentalFlags = new Set(experimentalFlags);
    }

    return GlobalConfig.parsedExperimentalFlags.has(key);
  }

  /**
   * only used for testing
   * @internal
   */
  static reset(): void {
    GlobalConfig.config = {};
    GlobalConfig.parsedExperimentalFlags.clear();
  }
}
