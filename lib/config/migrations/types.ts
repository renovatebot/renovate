import type { RenovateConfig } from './../types';
export interface MigrationConstructor {
  new (
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): Migration;
}

export interface Migration {
  readonly propertyName: string;
  run(value: unknown): void;
}
