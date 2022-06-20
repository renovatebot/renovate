import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { checkoutBranch } from '../../../../util/git';
import { getMigrationBranchName } from '../common';
import { createConfigMigrationBranch } from './create';
import type { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

export async function checkConfigMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData
): Promise<string | null> {
  logger.debug('checkConfigMigrationBranch()');
  if (!migratedConfigData) {
    logger.debug('checkConfigMigrationBranch() Config does not need migration');
    return null;
  }
  const configMigrationBranch = getMigrationBranchName(config);
  if (await migrationPrExists(configMigrationBranch)) {
    logger.debug('Config Migration PR already exists');
    await rebaseMigrationBranch(config, migratedConfigData);

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
    await createConfigMigrationBranch(config, migratedConfigData);
  }
  if (!GlobalConfig.get('dryRun')) {
    await checkoutBranch(configMigrationBranch);
  }
  return configMigrationBranch;
}

export async function migrationPrExists(branchName: string): Promise<boolean> {
  return !!(await platform.getBranchPr(branchName));
}
