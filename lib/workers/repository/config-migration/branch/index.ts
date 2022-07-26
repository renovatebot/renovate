import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { FindPRConfig, platform } from '../../../../modules/platform';
import { PrState } from '../../../../types';
import { checkoutBranch } from '../../../../util/git';
import type { BranchConfig } from '../../../types';
import { handlepr } from '../../update/branch/handle-existing';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { createConfigMigrationBranch } from './create';
import type { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

export async function checkConfigMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData | null
): Promise<string | null> {
  logger.debug('checkConfigMigrationBranch()');
  if (!migratedConfigData) {
    logger.debug('checkConfigMigrationBranch() Config does not need migration');
    return null;
  }
  const configMigrationBranch = getMigrationBranchName(config);
  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    migratedConfigData.filename
  );
  const prTitle = commitMessageFactory.create().toString();
  const closedPrConfig: FindPRConfig = {
    branchName: configMigrationBranch,
    prTitle,
    state: PrState.Closed,
  };
  const branchConfig: BranchConfig = {
    prTitle,
    manager: '',
    upgrades: [],
    branchName: configMigrationBranch,
    userStrings: {
      ignoreTopic:
        (config.ignoreTopic as string) ?? 'Renovate Ignore Notification',
      ignoreMajor: '',
      ignoreDigest: '',
      ignoreOther: '',
    },
    suppressNotifications: config.suppressNotifications,
  };

  const branchPr = await migrationPrExists(configMigrationBranch); // handles open/autoClosed PRs
  const closedPr = branchPr ? undefined : await platform.findPr(closedPrConfig); // handles closed PR

  // found closed migration PR
  if (closedPr) {
    logger.debug(
      { prTitle: closedPr.title },
      'Closed PR already exists. Skipping branch.'
    );
    await handlepr(branchConfig, closedPr);
    return null;
  }

  if (branchPr) {
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
