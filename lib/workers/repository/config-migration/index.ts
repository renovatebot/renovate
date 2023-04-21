import type { RenovateConfig } from '../../../config/types';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';

export async function configMigration(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  if (config.configMigration) {
    const migratedConfigData = await MigratedDataFactory.getAsync();
    const migrationBranch = await checkConfigMigrationBranch(
      config,
      migratedConfigData
    ); // null if migration not needed
    if (migrationBranch) {
      branchList.push(migrationBranch);
      await ensureConfigMigrationPr(config, migratedConfigData!);
    }
    MigratedDataFactory.reset();
  }
}
