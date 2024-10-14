import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';

export async function configMigration(
  config: RenovateConfig,
  branchList: string[],
): Promise<void> {
  if (config.configMigration) {
    if (config.mode === 'silent') {
      logger.debug(
        'Config migration issues are not created, updated or closed when mode=silent',
      );
      return;
    }
    const migratedConfigData = await MigratedDataFactory.getAsync();
    const migrationBranch = await checkConfigMigrationBranch(
      config,
      migratedConfigData,
    ); // null if migration not needed
    if (migrationBranch) {
      branchList.push(migrationBranch);
      await ensureConfigMigrationPr(config, migratedConfigData!);
    }
    MigratedDataFactory.reset();
  }
}
