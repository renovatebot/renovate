import { isPlainObject } from '@sindresorhus/is';
import { globalConfigOptionDefaults } from '../global-config-option-defaults.generated.ts';
import type {
  InternalGlobalConfigOptions,
  RenovateConfig,
  RepoGlobalConfig,
} from './types.ts';

const mergedDefaultOptions = new Set<string>(['repositoryCache']);

export class GlobalConfig {
  // TODO: once global config work is complete, add a test to make sure this list includes all options with globalOnly=true (#9603)
  static OPTIONS = [
    'allowCustomCrateGitRegistries',
    'allowCustomJuliaRegistries',
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
    'goEnvFromHostRules',
    'ignorePrAuthor',
    'includeMirrors',
    'inheritConfigTrusted',
    'internalHostAccess',
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
    'presetCachePersistence',
    'productLinks',
    'rebaseAllOpenBranches',
    'repositoryCache',
    'requireConfig',
    's3Endpoint',
    's3PathStyle',
    'toolSettings',
    'userAgent',
  ] as const satisfies readonly (
    keyof RepoGlobalConfig | keyof InternalGlobalConfigOptions
  )[];

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
    if (!key) {
      return GlobalConfig.config;
    }

    const defaultValue = globalConfigOptionDefaults[key];
    const value = GlobalConfig.config[key];
    // fill in the defaults of the fields these object options don't set
    if (
      mergedDefaultOptions.has(key) &&
      isPlainObject(defaultValue) &&
      isPlainObject(value)
    ) {
      return Object.assign({}, defaultValue, value) as Required<
        RepoGlobalConfig & InternalGlobalConfigOptions
      >[Key];
    }
    return (value ?? defaultValue) as Required<
      RepoGlobalConfig & InternalGlobalConfigOptions
    >[Key];
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

/**
 * Sets the global options which HTTP requests consult, for the requests made before the full global config is set.
 */
export function setHttpGlobalConfig(
  config: RenovateConfig & RepoGlobalConfig,
): void {
  GlobalConfig.set({
    allowedHeaders: config.allowedHeaders,
    endpoint: config.endpoint,
    internalHostAccess: config.internalHostAccess,
    platform: config.platform,
    userAgent: config.userAgent,
  });
}
