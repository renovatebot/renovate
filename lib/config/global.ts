import type { RenovateConfig, RepoGlobalConfig } from './types';

export class GlobalConfig {
  // TODO: once global config work is complete, add a test to make sure this list includes all options with globalOnly=true (#9603)
  private static readonly OPTIONS = [
    'allowCustomCrateRegistries',
    'allowPlugins',
    'allowPostUpgradeCommandTemplating',
    'allowScripts',
    'allowedPostUpgradeCommands',
    'binarySource',
    'customEnvVariables',
    'dockerChildPrefix',
    'dockerImagePrefix',
    'dockerUser',
    'dryRun',
    'exposeAllEnv',
    'migratePresets',
    'privateKey',
    'privateKeyOld',
    'localDir',
    'cacheDir',
  ];

  private static config: RepoGlobalConfig = {};

  static get(): RepoGlobalConfig;
  static get<Key extends keyof RepoGlobalConfig>(
    key?: Key
  ): RepoGlobalConfig[Key];
  static get<Key extends keyof RepoGlobalConfig>(
    key?: Key
  ): RepoGlobalConfig | RepoGlobalConfig[Key] {
    return key ? GlobalConfig.config[key] : GlobalConfig.config;
  }

  static set(config: RenovateConfig | RepoGlobalConfig): RenovateConfig {
    GlobalConfig.reset();

    const result = { ...config };
    for (const option of GlobalConfig.OPTIONS) {
      GlobalConfig.config[option] = config[option];
      delete result[option];
    }

    return result;
  }

  static reset(): void {
    GlobalConfig.config = {};
  }

  static get isDryRun(): boolean {
    return GlobalConfig.get('dryRun');
  }
}
