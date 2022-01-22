import type { RenovateConfig } from './../types';
export interface MigrationConstructor {
  new (
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): Migration;
}

export interface Migration {
  readonly deprecated: boolean;
  readonly propertyName: string;
  run(value: unknown): void;
}
