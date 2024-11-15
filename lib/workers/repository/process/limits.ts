import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { BranchConfig } from '../../types';

export async function getPrHourlyCount(
  config: RenovateConfig,
): Promise<number> {
  try {
    const prList = await platform.getPrList();
    const currentHourStart = DateTime.local().startOf('hour');
    logger.debug(
      `Calculating PRs created so far in this hour currentHourStart=${String(currentHourStart)}`,
    );
    const soFarThisHour = prList.filter(
      (pr) =>
        pr.sourceBranch !== config.onboardingBranch &&
        pr.sourceBranch.startsWith(config.branchPrefix!) &&
        DateTime.fromISO(pr.createdAt!) > currentHourStart,
    );
    logger.debug(
      `${soFarThisHour.length} PRs have been created so far in this hour.`,
    );
    return soFarThisHour.length;
  } catch (err) {
    // istanbul ignore if
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.error({ err }, 'Error checking PRs created per hour');
    return 0;
  }
}

export async function getConcurrentPrsCount(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<number> {
  const openPrs: Pr[] = [];
  for (const { branchName } of branches) {
    try {
      const pr = await platform.getBranchPr(branchName, config.baseBranch);
      if (
        pr &&
        pr.sourceBranch !== config.onboardingBranch &&
        pr.state === 'open'
      ) {
        openPrs.push(pr);
      }
    } catch (err) {
      // istanbul ignore if
      if (err instanceof ExternalHostError) {
        throw err;
      } else {
        // no-op
      }
    }
  }

  logger.debug(`${openPrs.length} PRs are currently open`);
  return openPrs.length;
}

export async function getConcurrentBranchesCount(
  branches: BranchConfig[],
): Promise<number> {
  const existingBranches: string[] = [];
  for (const branch of branches) {
    if (await scm.branchExists(branch.branchName)) {
      existingBranches.push(branch.branchName);
    }
  }

  const existingCount = existingBranches.length;
  logger.debug(
    `${existingCount} already existing branches found: ${existingBranches.join()}`,
  );
  return existingCount;
}
