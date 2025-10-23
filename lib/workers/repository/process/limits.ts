import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getCache } from '../../../util/cache/repository';
import type { BranchConfig } from '../../types';

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
        pr.sourceBranch !== config.onboardingBranch &&
        pr.sourceBranch.startsWith(config.branchPrefix!) &&
        DateTime.fromISO(pr.createdAt!, { zone: 'utc' }) > currentHourStart,
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
        pr.sourceBranch !== config.onboardingBranch &&
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

export async function getCommitsHourlyCount(
  branches: BranchConfig[],
): Promise<number> {
  try {
    const currentHourStart = DateTime.local().setZone('utc').startOf('hour');
    logger.debug(
      `Calculating commits so far in this hour currentHourStart=${String(currentHourStart)}`,
    );

    const cache = getCache();
    const cachedBranches = cache.branches ?? [];

    let soFarThisHour = 0;
    for (const branch of branches) {
      // First try to get from cache
      const branchCache = cachedBranches.find(
        (b) => b.branchName === branch.branchName,
      );

      if (branchCache?.commitTimestamp) {
        const commitTime = DateTime.fromISO(branchCache.commitTimestamp, {
          zone: 'utc',
        });
        if (commitTime > currentHourStart) {
          soFarThisHour++;
        }
      } else {
        // Fallback to SCM if not in cache (shouldn't happen often after initial run)
        const updateDate = await scm.getBranchUpdateDate(branch.branchName);
        if (updateDate && updateDate > currentHourStart) {
          soFarThisHour++;
        }
      }
    }
    logger.debug(`${soFarThisHour} commits so far in this hour.`);
    return soFarThisHour;
  } catch (err) {
    logger.error({ err }, 'Error checking commits per hour');
    return 0;
  }
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
