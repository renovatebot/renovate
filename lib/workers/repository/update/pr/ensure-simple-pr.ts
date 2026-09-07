import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import { hashBody } from '../../../../modules/platform/pr-body.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import { isPrAlreadyExistsError } from './errors.ts';
import { getPlatformPrOptions } from './index.ts';
import { prepareLabels } from './labels.ts';
import { addParticipants } from './participants.ts';

export interface EnsureSimplePrConfig {
  branchName: string;
  targetBranch: string;
  prTitle: string;
  /** Fully rendered body, including any header and footer. */
  prBody: string;
  config: RenovateConfig;
  /** Open PR for `branchName`, if the caller already looked it up. */
  existingPr: Pr | null;
  /** Lowercase name of the PR flavor, used in log messages. */
  logName: string;
}

/**
 * Creates or updates a PR which Renovate renders from a static template, i.e.
 * the onboarding PR and the config migration PR.
 *
 * Unlike `ensurePr()` these PRs have no upgrades, no PR cache and no label
 * reconciliation - they are only created, or updated whenever their body or
 * title changed.
 */
export async function ensureSimplePr({
  branchName,
  targetBranch,
  prTitle,
  prBody: renderedPrBody,
  config,
  existingPr,
  logName,
}: EnsureSimplePrConfig): Promise<Pr | null> {
  logger.trace({ prBody: renderedPrBody }, 'prBody');
  const prBody = platform.massageMarkdown(renderedPrBody, config.rebaseLabel);

  if (existingPr) {
    logger.debug(`Found open ${logName} PR`);
    // Check if existing PR needs updating
    if (
      existingPr.bodyStruct?.hash === hashBody(prBody) &&
      existingPr.title === prTitle
    ) {
      logger.debug(`Pull Request #${existingPr.number} does not need updating`);
      return existingPr;
    }
    // PR must need updating
    if (GlobalConfig.get('dryRun')) {
      logger.info(`DRY-RUN: Would update ${logName} PR`);
      return existingPr;
    }
    await platform.updatePr({
      number: existingPr.number,
      prTitle,
      prBody,
    });
    logger.info({ pr: existingPr.number }, `Updated ${logName} PR`);
    return existingPr;
  }

  logger.debug(`Creating ${logName} PR`);
  if (GlobalConfig.get('dryRun')) {
    logger.info(`DRY-RUN: Would create ${logName} PR`);
    return null;
  }

  try {
    const pr = await platform.createPr({
      sourceBranch: branchName,
      targetBranch,
      prTitle,
      prBody,
      labels: prepareLabels(config),
      platformPrOptions: getPlatformPrOptions({
        ...config,
        automerge: false,
      }),
    });
    logger.info({ pr: pr?.number }, `Created ${logName} PR`);
    if (pr) {
      await addParticipants(config, pr);
    }
    return pr;
  } catch (err) {
    if (isPrAlreadyExistsError(err)) {
      logger.warn(
        { err, branchName },
        'PR already exists but cannot find it. It was probably created by a different user.',
      );
      await scm.deleteBranch(branchName);
      return null;
    }
    throw err;
  }
}
