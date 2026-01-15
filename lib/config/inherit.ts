import type { RenovateConfig, RepoInheritConfig } from './types';

export class InheritConfig {
  static OPTIONS: readonly (keyof RepoInheritConfig)[] = ['configFileNames'];

  private static config: RepoInheritConfig = {};

  static get<Key extends keyof RepoInheritConfig>(
    key: Key,
  ): RepoInheritConfig[Key] {
    return InheritConfig.config[key];
  }

  static set(config: RenovateConfig & RepoInheritConfig): RenovateConfig {
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
