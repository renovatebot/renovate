import { globalConfigOptionDefaults } from '../global-config-option-defaults.generated.ts';
import type { GlobalDefaultedConfigKey } from './defaults.ts';
import { globalConfigOptions } from './global-options.ts';
import type {
  InternalGlobalConfigOptions,
  RenovateConfigFile,
  RepoGlobalConfig,
} from './types.ts';

type GlobalConfigValues = RepoGlobalConfig & InternalGlobalConfigOptions;

export type GlobalConfigKey = keyof GlobalConfigValues;

/**
 * The value `GlobalConfig.get()` gives for an option, which is only missing for an option without a default.
 */
export type GlobalConfigValue<Key extends GlobalConfigKey> =
  Key extends GlobalDefaultedConfigKey
    ? NonNullable<GlobalConfigValues[Key]>
    : GlobalConfigValues[Key];

export class GlobalConfig {
  static OPTIONS = globalConfigOptions;

  private static config: GlobalConfigValues = {};

  /**
   * Without a key, gives the config as it was set, without the defaults of the options.
   */
  static get(): GlobalConfigValues;
  static get<Key extends GlobalConfigKey>(key: Key): GlobalConfigValue<Key>;
  static get(key?: GlobalConfigKey): unknown {
    if (key) {
      return GlobalConfig.config[key] ?? globalConfigOptionDefaults[key];
    }

    return GlobalConfig.config;
  }

  /**
   * Gives a directory which the global worker sets before it processes a repository.
   */
  static getRequired(key: 'cacheDir' | 'localDir'): string {
    const value = GlobalConfig.get(key);
    if (value === undefined) {
      throw new Error(`Global config ${key} is not set`);
    }
    return value;
  }

  /**
   * Sets the global options of `config`, and gives the config without them.
   */
  static set<
    T extends RenovateConfigFile &
      RepoGlobalConfig &
      InternalGlobalConfigOptions,
  >(config: T): Omit<T, (typeof globalConfigOptions)[number]> {
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
  config: RenovateConfigFile & RepoGlobalConfig,
): void {
  GlobalConfig.set({
    allowedHeaders: config.allowedHeaders,
    endpoint: config.endpoint,
    internalHostAccess: config.internalHostAccess,
    platform: config.platform,
    userAgent: config.userAgent,
  });
}
