import type { GlobalInheritableConfig, RenovateConfig } from './types.ts';

export const NOT_PRESENT = Symbol('not-present');

export class InheritConfig {
  static OPTIONS: readonly (keyof GlobalInheritableConfig)[] = [
    'bbUseDevelopmentBranch',
    'configFileNames',
    'onboardingAutoCloseAge',
    'onboardingBranch',
  ];

  private static config: GlobalInheritableConfig = {};

  static get<Key extends keyof GlobalInheritableConfig>(
    key: Key,
  ): GlobalInheritableConfig[Key] | typeof NOT_PRESENT {
    if (key in InheritConfig.config) {
      return InheritConfig.config[key];
    }

    return NOT_PRESENT;
  }

  static set(config: RenovateConfig & GlobalInheritableConfig): RenovateConfig {
    InheritConfig.reset();

    const result = { ...config };
    for (const option of InheritConfig.OPTIONS) {
      if (option in config) {
        InheritConfig.config[option] = config[option] as never;
      }
      delete result[option];
    }

    return result;
  }

  static reset(): void {
    InheritConfig.config = {};
  }
}
