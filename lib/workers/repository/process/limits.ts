import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getInheritedOrGlobal } from '../../../util/common.ts';
import type { BranchConfig } from '../../types.ts';

export async function getPrHourlyCount(
  config: RenovateConfig,
): Promise<number> {
  try {
    const prList = await platform.getPrList();
    const currentHourStart = DateTime.local().setZone('utc').startOf('hour');
    logger.debug(
      `Calculating PRs created so far in this hour currentHourStart=${String(currentHourStart)}`,
    );
    const soFarThisHour = prList.filter(
      (pr) =>
        pr.sourceBranch !== getInheritedOrGlobal('onboardingBranch') &&
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
  let openPrCount = 0;
  for (const { branchName } of branches) {
    try {
      const pr = await platform.getBranchPr(branchName, config.baseBranch);
      if (
        pr &&
        pr.sourceBranch !== getInheritedOrGlobal('onboardingBranch') &&
        pr.state === 'open'
      ) {
        openPrCount++;
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

  logger.debug(`${openPrCount} PRs are currently open`);
  return openPrCount;
}

export async function getConcurrentBranchesCount(
  branches: BranchConfig[],
): Promise<number> {
  let existingBranchCount = 0;
  for (const branch of branches) {
    if (await scm.branchExists(branch.branchName)) {
      existingBranchCount++;
    }
  }

  logger.debug(`${existingBranchCount} already existing branches found.`);
  return existingBranchCount;
}
