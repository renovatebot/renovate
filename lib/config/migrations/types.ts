import type { AllConfig, RenovateConfigFile } from './../types.ts';
export type MigrationConstructor = new (
  originalConfig: MigratableConfig,
  migratedConfig: RenovateConfigFile,
) => Migration;

export interface Migration {
  readonly deprecated: boolean;
  readonly propertyName: string | RegExp;
  run(value: unknown, key: string, parentKey?: string): void;
}

// TODO: add migrated properties used by migrations
export type MigratableConfig<T extends RenovateConfigFile = AllConfig> = T & {
  exposeEnv?: unknown;
  node?: RenovateConfigFile;
  packageNames?: unknown[];
  packagePatterns?: unknown[];
  rebaseConflictedPrs?: unknown;
  travis?: RenovateConfigFile;
};
