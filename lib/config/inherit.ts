import type { RenovateConfig, GlobalInheritableConfig } from './types';

export class InheritConfig {
  static OPTIONS: readonly (keyof GlobalInheritableConfig)[] = [
    'configFileNames',
  ];

  private static config: GlobalInheritableConfig = {};

  static get<Key extends keyof GlobalInheritableConfig>(
    key: Key,
  ): GlobalInheritableConfig[Key] {
    return InheritConfig.config[key];
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
