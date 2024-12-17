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
      'Config migration issues are not created, updated or closed when mode=silent',
    );
    return { result: 'no-migration' };
  }

  const migratedConfigData = await MigratedDataFactory.getAsync();
  if (!migratedConfigData) {
    logger.debug('Config does not need migration');
    MigratedDataFactory.reset();
    return { result: 'no-migration' };
  }

  if (migratedConfigData.filename === 'package.json') {
    logger.debug(
      ' Using package.json for Renovate config is deprecated - please use a dedicated configuration file instead. Skipping config migration.',
    );
    MigratedDataFactory.reset();
    return { result: 'no-migration' };
  }

  const res = await checkConfigMigrationBranch(config, migratedConfigData);

  // migration needed but not demanded by user
  if (res.result === 'no-migration-branch') {
    MigratedDataFactory.reset();
    return { result: 'add-checkbox' };
  }

  branchList.push(res.migrationBranch);

  const pr = await ensureConfigMigrationPr(config, migratedConfigData);

  // only happens incase a migration pr was created by another user
  // for other cases in which a PR could not be found or created: we log warning and throw error from within the ensureConfigMigrationPr fn
  if (!pr) {
    MigratedDataFactory.reset();
    return { result: 'add-checkbox' };
  }

  MigratedDataFactory.reset();

  return {
    result:
      res.result === 'migration-branch-exists' ? 'pr-exists' : 'pr-modified',
    prNumber: pr.number,
  };
}
