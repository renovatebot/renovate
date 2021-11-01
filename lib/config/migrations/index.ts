import { RenovateConfig } from '../types';
import type { Migration } from './migration';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

export function applyMigrations(
  originalConfig: RenovateConfig,
  migratedConfig: RenovateConfig
): RenovateConfig {
  const migrations: Migration[] = [
    new RequiredStatusChecksMigration(originalConfig, migratedConfig),
  ];

  for (const migration of migrations) {
    migration.migrate();
  }

  return migratedConfig;
}
