import type { RenovateConfig } from './../types';
export type MigrationConstructor = new (
  originalConfig: RenovateConfig,
  migratedConfig: RenovateConfig,
) => Migration;

export interface Migration {
  readonly deprecated: boolean;
  readonly propertyName: string | RegExp;
  run(value: unknown, key: string, parentKey?: string): void;
}
