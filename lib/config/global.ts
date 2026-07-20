import { globalConfigOptionDefaults } from '../global-config-option-defaults.generated.ts';
import type {
  InternalGlobalConfigOptions,
  RenovateConfig,
  RepoGlobalConfig,
} from './types.ts';

export class GlobalConfig {
  // TODO: once global config work is complete, add a test to make sure this list includes all options with globalOnly=true (#9603)
  static OPTIONS: readonly (
    | keyof RepoGlobalConfig
    | keyof InternalGlobalConfigOptions
  )[] = [
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
    /** NOTE that this is not a config option, but an internal variable **/
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

  private static config: RepoGlobalConfig & InternalGlobalConfigOptions = {};

  static get(): RepoGlobalConfig & InternalGlobalConfigOptions;
  static get<
    Key extends keyof RepoGlobalConfig | keyof InternalGlobalConfigOptions,
  >(key: Key): Required<RepoGlobalConfig & InternalGlobalConfigOptions>[Key];
  static get<
    Key extends keyof RepoGlobalConfig | keyof InternalGlobalConfigOptions,
  >(
    key?: Key,
  ):
    | (RepoGlobalConfig & InternalGlobalConfigOptions)
    | Required<RepoGlobalConfig & InternalGlobalConfigOptions>[Key] {
    const defaultValue = key
      ? (globalConfigOptionDefaults[key] as Required<
          RepoGlobalConfig & InternalGlobalConfigOptions
        >[Key])
      : undefined;

    return key
      ? ((GlobalConfig.config[key] ?? defaultValue) as Required<
          RepoGlobalConfig & InternalGlobalConfigOptions
        >[Key])
      : GlobalConfig.config;
  }

  static set(
    config: RenovateConfig & RepoGlobalConfig & InternalGlobalConfigOptions,
  ): RenovateConfig {
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
