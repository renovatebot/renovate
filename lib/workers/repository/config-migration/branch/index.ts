import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { FindPRConfig, Pr, platform } from '../../../../modules/platform';
import { ensureComment } from '../../../../modules/platform/comment';
import { scm } from '../../../../modules/platform/scm';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { createConfigMigrationBranch } from './create';
import type { MigratedData } from './migrated-data';
import { rebaseMigrationBranch } from './rebase';

export async function checkConfigMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData | null,
): Promise<string | null> {
  logger.debug('checkConfigMigrationBranch()');
  if (!migratedConfigData) {
    logger.debug('checkConfigMigrationBranch() Config does not need migration');
    return null;
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
      logger.debug(
        { prTitle: closedPr.title },
        'Closed PR already exists. Skipping branch.',
      );
      await handlePr(config, closedPr);
      return null;
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
  return configMigrationBranch;
}

export async function migrationPrExists(
  branchName: string,
  targetBranch?: string,
): Promise<boolean> {
  return !!(await platform.getBranchPr(branchName, targetBranch));
}

async function handlePr(config: RenovateConfig, pr: Pr): Promise<void> {
  if (
    pr.state === 'closed' &&
    !config.suppressNotifications!.includes('prIgnoreNotification')
  ) {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`,
      );
    } else {
      const content =
        '\n\nIf you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.';
      await ensureComment({
        number: pr.number,
        topic: 'Renovate Ignore Notification',
        content,
      });
    }
    if (await scm.branchExists(pr.sourceBranch)) {
      if (GlobalConfig.get('dryRun')) {
        logger.info('DRY-RUN: Would delete branch ' + pr.sourceBranch);
      } else {
        await scm.deleteBranch(pr.sourceBranch);
      }
    }
  }
}
