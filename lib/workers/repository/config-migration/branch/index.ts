import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { FindPRConfig, Pr } from '../../../../modules/platform';
import { platform } from '../../../../modules/platform';
import { scm } from '../../../../modules/platform/scm';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { createConfigMigrationBranch } from './create';
import type { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

interface CheckConfigMigrationBranchResult {
  migrationBranch?: string;
  result?: string;
  prNumber?: number;
}

export async function checkConfigMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData | null,
): Promise<CheckConfigMigrationBranchResult> {
  logger.debug('checkConfigMigrationBranch()');
  if (!migratedConfigData) {
    logger.debug('checkConfigMigrationBranch() Config does not need migration');
    return { result: 'nothing' };
  }

  if (
    !config.configMigration &&
    !config.dependencyDashboardChecks?.createMigrationPr
  ) {
    logger.debug(
      'Config migration needed but config migration is disabled and checkbox not ticked.',
    );
    return { result: 'add-checkbox' };
  }

  const configMigrationBranch = getMigrationBranchName(config);

  const branchPr = await migrationPrExists(
    configMigrationBranch,
    config.baseBranch,
  ); // handles open/autoClosed PRs

  if (!branchPr) {
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      migratedConfigData.filename,
    );
    const prTitle = commitMessageFactory.getPrTitle();
    const closedPrConfig: FindPRConfig = {
      branchName: configMigrationBranch,
      prTitle,
      state: 'closed',
      targetBranch: config.baseBranch,
    };

    // handles closed PR
    const closedPr = await platform.findPr(closedPrConfig);

    // found closed migration PR
    if (closedPr) {
      logger.debug('Closed config migration PR found.');

      // previously we used to add a comment and skip the branch
      // but now we add a checkbox in DD
      // if checkbox is ticked then remove this branch/pr and create a new one

      if (!config.dependencyDashboardChecks?.createMigrationPr) {
        logger.debug(
          'Closed PR and config migration enabled. Adding checkbox to DD, will check in next run.',
        );
        return { result: 'add-checkbox' };
      }

      logger.debug(
        'Closed migration PR found and checkbox is ticked so delete this branch and create a new one.',
      );
      await handlePr(config, closedPr);
    }
  }

  if (branchPr) {
    logger.debug('Config Migration PR already exists');
    await rebaseMigrationBranch(config, migratedConfigData);
    if (platform.refreshPr) {
      const configMigrationPr = await platform.getBranchPr(
        configMigrationBranch,
        config.baseBranch,
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
    await scm.checkoutBranch(configMigrationBranch);
  }
  return {
    migrationBranch: configMigrationBranch,
    result: 'pr-created',
    prNumber: branchPr?.number,
  };
}

export async function migrationPrExists(
  branchName: string,
  targetBranch?: string,
): Promise<Pr | null> {
  return await platform.getBranchPr(branchName, targetBranch);
}

async function handlePr(config: RenovateConfig, pr: Pr): Promise<void> {
  if (await scm.branchExists(pr.sourceBranch)) {
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would delete branch ' + pr.sourceBranch);
    } else {
      await scm.deleteBranch(pr.sourceBranch);
    }
  }
}
