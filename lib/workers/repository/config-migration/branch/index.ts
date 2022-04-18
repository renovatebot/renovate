import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { checkoutBranch } from '../../../../util/git';
import * as template from '../../../../util/template';
import { createConfigMigrationBranch } from './create';
import { MigratedDataFactory } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

export async function checkConfigMigrationBranch(
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('checkConfigMigrationBranch()');
  logger.trace({ config });
  const migratedConfigData = await MigratedDataFactory.getAsync(config);
  if (!migratedConfigData) {
    logger.debug('checkConfigMigrationBranch() Error fetching migrated data');
    return config;
  }
  const configMigrationBranch = template.compile(
    config.configMigrationBranch,
    config
  );
  if (await migrationPrExists(config)) {
    logger.debug('Config Migration PR already exists');
    const commit = await rebaseMigrationBranch(config, migratedConfigData);
    if (commit) {
      logger.info({ branch: configMigrationBranch, commit }, 'Branch updated');
    }
    // istanbul ignore if
    if (platform.refreshPr) {
      const configMigrationPr = await platform.getBranchPr(
        configMigrationBranch
      );
      await platform.refreshPr(configMigrationPr.number);
    }
  } else {
    logger.debug('Config Migration PR does not exist');
    logger.debug('Need to create migration PR');
    const commit = await createConfigMigrationBranch(
      config,
      migratedConfigData
    );
    // istanbul ignore if
    if (commit) {
      logger.info({ branch: configMigrationBranch, commit }, 'Branch created');
    }
  }
  if (!GlobalConfig.get('dryRun')) {
    await checkoutBranch(configMigrationBranch);
  }
  MigratedDataFactory.reset();
  const branchList = [configMigrationBranch];
  return { ...config, configMigrationBranch, branchList };
}

export const migrationPrExists = async (
  config: RenovateConfig
): Promise<boolean> =>
  !!(await platform.getBranchPr(config.configMigrationBranch));
