import type { RenovateConfig, RepoInheritConfig } from './types';

export class InheritConfig {
  static OPTIONS: readonly (keyof RepoInheritConfig)[] = [
    'onboardingBranch',
    'onboardingCommitMessage',
    'configFileNames',
    'onboardingConfigFileName',
    'onboardingNoDeps',
    'onboardingPrTitle',
    'onboarding',
    'onboardingConfig',
    'requireConfig',
    'bbUseDevelopmentBranch',
  ];

  private static config: RepoInheritConfig = {};

  static get(): RepoInheritConfig;
  static get<Key extends keyof RepoInheritConfig>(
    key: Key,
  ): RepoInheritConfig[Key];
  static get<Key extends keyof RepoInheritConfig>(
    key: Key,
    defaultValue: Required<RepoInheritConfig>[Key],
  ): Required<RepoInheritConfig>[Key];
  static get<Key extends keyof RepoInheritConfig>(
    key?: Key,
    defaultValue?: RepoInheritConfig[Key],
  ): RepoInheritConfig | RepoInheritConfig[Key] {
    return key
      ? (InheritConfig.config[key] ?? defaultValue)
      : InheritConfig.config;
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
