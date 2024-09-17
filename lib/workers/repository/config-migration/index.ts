import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';

export type ConfigMigrationResult =
  | { result: 'no-migration' }
  | { result: 'add-checkbox' }
  | { result: 'pr-exists'; prNumber: number };

export async function configMigration(
  config: RenovateConfig,
  branchList: string[],
): Promise<ConfigMigrationResult> {
  if (config.mode === 'silent') {
    logger.debug(
      'Config migration issues are not created, updated or closed when mode=silent',
    );
    return { result: 'no-migration' };
  }

  const migratedConfigData = await MigratedDataFactory.getAsync();
  const res = await checkConfigMigrationBranch(config, migratedConfigData);

  if (res.result !== 'migration-branch-exists') {
    return { result: res.result };
  }

  branchList.push(res.migrationBranch);

  const pr = await ensureConfigMigrationPr(config, migratedConfigData!);

  // only happens incase a migration pr was created by different user
  // for other cases in which a pr could not be found/created we throw error from within the ensureConfigMigrationPr fn
  if (!pr) {
    return { result: 'add-checkbox' };
  }

  MigratedDataFactory.reset();

  return { result: 'pr-exists', prNumber: pr.number };
}
