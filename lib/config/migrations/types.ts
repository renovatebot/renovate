import { RenovateConfig } from './../types';
import { AbstractMigration } from './base/abstract-migration';
export interface MigrationConstructor {
  new (
    originalConfig: RenovateConfig,
    migratedConfig: RenovateConfig
  ): AbstractMigration;
}
