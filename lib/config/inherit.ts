import type { GlobalInheritableConfig, RenovateConfig } from './types.ts';

export const NOT_PRESET = Symbol('not-present');

export class InheritConfig {
  static OPTIONS: readonly (keyof GlobalInheritableConfig)[] = [
    'configFileNames',
  ];

  private static config: GlobalInheritableConfig = {};

  static get<Key extends keyof GlobalInheritableConfig>(
    key: Key,
  ): GlobalInheritableConfig[Key] | typeof NOT_PRESET {
    if (key in InheritConfig.config) {
      return InheritConfig.config[key];
    }

    return NOT_PRESET;
  }

  static set(config: RenovateConfig & GlobalInheritableConfig): RenovateConfig {
    InheritConfig.reset();

    const result = { ...config };
    for (const option of InheritConfig.OPTIONS) {
      InheritConfig.config[option] = config[option] as never;
      delete result[option];
    }

    return result;
  }

  static reset(): void {
    InheritConfig.config = {};
  }
}
