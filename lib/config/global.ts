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

  static reset(): void {
    GlobalConfig.config = {};
    ExperimentalFlag.reset();
  }
}
export class ExperimentalFlag {
  private static parsedFlags: Record<string, string> = {};

  static get(key: string): string | null {
    const experimentalFlags = GlobalConfig.get('experimentalFlags');

    if (!experimentalFlags) {
      return null;
    }

    // Check if the flag value is already parsed and stored
    if (ExperimentalFlag.parsedFlags[key]) {
      return ExperimentalFlag.parsedFlags[key];
    }

    for (const flag of experimentalFlags) {
      if (flag.includes(key)) {
        const [name, value] = flag.split('=');
        ExperimentalFlag.parsedFlags[name] = value ?? name;
        return value ?? name;
      }
    }

    return null;
  }

  /**
   * only used for testing
   */
  static reset(): void {
    ExperimentalFlag.parsedFlags = {};
  }
}
