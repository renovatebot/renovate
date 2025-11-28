import type { AllConfig, RenovateConfig } from './../types';
export type MigrationConstructor = new (
  originalConfig: MigratableConfig,
  migratedConfig: RenovateConfig,
) => Migration;

export interface Migration {
  readonly deprecated: boolean;
  readonly propertyName: string | RegExp;
  run(value: unknown, key: string, parentKey?: string): void;
}

// TODO: add migrated properties used by migrations
export type MigratableConfig<T extends RenovateConfig = AllConfig> = T & {
  exposeEnv?: unknown;
  node?: RenovateConfig;
  packageNames?: unknown[];
  packagePatterns?: unknown[];
  rebaseConflictedPrs?: unknown;
  travis?: RenovateConfig;
};
