import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { FindPRConfig, Pr, platform } from '../../../../modules/platform';
import { ensureComment } from '../../../../modules/platform/comment';
import { PrState } from '../../../../types';
import {
  branchExists,
  checkoutBranch,
  deleteBranch,
} from '../../../../util/git';
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

  const branchPr = await migrationPrExists(configMigrationBranch); // handles open/autoClosed PRs

  if (!branchPr) {
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      migratedConfigData.filename
    );
    const prTitle = commitMessageFactory.getPrTitle();
    const closedPrConfig: FindPRConfig = {
      branchName: configMigrationBranch,
      prTitle,
      state: PrState.Closed,
    };

    // handles closed PR
    const closedPr = await platform.findPr(closedPrConfig);

    // found closed migration PR
    if (closedPr) {
      logger.debug(
        { prTitle: closedPr.title },
        'Closed PR already exists. Skipping branch.'
      );
      await handlepr(config, closedPr);
      return null;
    }
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

async function handlepr(config: RenovateConfig, pr: Pr): Promise<void> {
  if (
    pr.state === PrState.Closed &&
    !config.suppressNotifications!.includes('prIgnoreNotification')
  ) {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would ensure closed PR comment in PR #${pr.number}`
      );
    } else {
      const content =
        '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
      await ensureComment({
        number: pr.number,
        topic: 'Renovate Ignore Notification',
        content,
      });
    }
    if (branchExists(pr.sourceBranch)) {
      if (GlobalConfig.get('dryRun')) {
        logger.info('DRY-RUN: Would delete branch ' + pr.sourceBranch);
      } else {
        await deleteBranch(pr.sourceBranch);
      }
    }
  }
}
