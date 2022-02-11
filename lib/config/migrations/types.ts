import type {
  GlobalOnlyConfig,
  RenovateConfig,
  RepoGlobalConfig,
} from './../types';
export interface MigrationConstructor {
  new (
    originalConfig: DeprecatedRenovateConfig,
    migratedConfig: DeprecatedRenovateConfig
  ): Migration;
}

export interface Migration<
  TConfig extends DeprecatedRenovateConfig = DeprecatedRenovateConfig
> {
  readonly deprecated: boolean;
  readonly propertyName: string | keyof TConfig;
  run(value: unknown): void;
}

export interface DeprecatedRenovateConfig
  extends RenovateConfig,
    RepoGlobalConfig,
    GlobalOnlyConfig,
    Record<string, unknown> {}
