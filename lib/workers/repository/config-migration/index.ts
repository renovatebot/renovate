import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';

export type ConfigMigrationResult =
  | { result: 'no-migration' }
  | { result: 'add-checkbox' }
  | { result: 'pr-exists' | 'pr-modified'; prNumber: number };

export async function configMigration(
  config: RenovateConfig,
  branchList: string[],
): Promise<ConfigMigrationResult> {
  if (config.mode === 'silent') {
    logger.debug(
      'configMigration(): Config migration issues are not created, updated or closed when mode=silent',
    );
    return { result: 'no-migration' };
  }

  const migratedConfigData = await MigratedDataFactory.getAsync();
  if (!migratedConfigData) {
    logger.debug('configMigration(): Config does not need migration');
    MigratedDataFactory.reset();
    return { result: 'no-migration' };
  }

  const res = await checkConfigMigrationBranch(config, migratedConfigData);

  // migration needed but not demanded by user
  if (res.result === 'no-migration-branch') {
    return { result: 'add-checkbox' };
  }

  branchList.push(res.migrationBranch);

  const pr = await ensureConfigMigrationPr(config, migratedConfigData);

  // only happens incase a migration pr was created by another user
  // for other cases in which a pr could not be found/created we throw error from within the ensureConfigMigrationPr fn
  if (!pr) {
    // warning already logged within ensureConfigMigrationPr need to log here again
    return { result: 'add-checkbox' };
  }

  MigratedDataFactory.reset();

  return {
    result:
      res.result === 'migration-branch-exists' ? 'pr-exists' : 'pr-modified',
    prNumber: pr.number,
  };
}
