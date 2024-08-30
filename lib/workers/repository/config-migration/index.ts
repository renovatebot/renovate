import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';

export interface ConfigMigrationResult {
  result?: 'add-checkbox' | 'pr-exists';
  prNumber?: number;
}

export async function configMigration(
  config: RenovateConfig,
  branchList: string[],
): Promise<ConfigMigrationResult> {
  if (config.mode === 'silent') {
    logger.debug(
      'Config migration issues are not created, updated or closed when mode=silent',
    );
    return {};
  }

  let pr: Pr | null = null;
  const migratedConfigData = await MigratedDataFactory.getAsync();
  const { migrationBranch, result, prNumber } =
    await checkConfigMigrationBranch(config, migratedConfigData); // null if migration not needed

  if (migrationBranch) {
    branchList.push(migrationBranch);
    pr = await ensureConfigMigrationPr(config, migratedConfigData!);
  }
  MigratedDataFactory.reset();

  return { result, prNumber: pr?.number ?? prNumber };
}
