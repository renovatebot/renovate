import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { checkoutBranch } from '../../../../util/git';
import { getMigrationBranchName } from '../common';
import { createConfigMigrationBranch } from './create';
import { MigratedDataFactory } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

export async function checkConfigMigrationBranch(
  config: RenovateConfig
): Promise<string | null> {
  logger.debug('checkConfigMigrationBranch()');
  const migratedConfigData = await MigratedDataFactory.getAsync();
  if (!migratedConfigData) {
    logger.debug(
      'checkConfigMigrationBranch() Config does not need migration\n'
    );
    return null;
  }
  const configMigrationBranch = getMigrationBranchName(config);
  if (await migrationPrExists(configMigrationBranch)) {
    logger.debug('Config Migration PR already exists');
    await rebaseMigrationBranch(config, migratedConfigData);
    // istanbul ignore if
    if (platform.refreshPr) {
      const configMigrationPr = await platform.getBranchPr(
        configMigrationBranch
      );
      if (configMigrationPr) {
        await platform.refreshPr(configMigrationPr.number);
      }
    }
  } else {
    logger.debug('Config Migration PR does not exist');
    logger.debug('Need to create migration PR');
    const commit = await createConfigMigrationBranch(
      config,
      migratedConfigData
    );

    if (commit) {
      logger.info({ branch: configMigrationBranch, commit }, 'Branch created');
    }
  }
  if (!GlobalConfig.get('dryRun')) {
    await checkoutBranch(configMigrationBranch);
  }
  MigratedDataFactory.reset();
  return configMigrationBranch;
}

export const migrationPrExists = async (branchName: string): Promise<boolean> =>
  !!(await platform.getBranchPr(branchName));
