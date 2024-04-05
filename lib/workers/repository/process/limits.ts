import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { Pr, platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { BranchConfig } from '../../types';

export async function getPrHourlyRemaining(
  config: RenovateConfig,
): Promise<number> {
  if (config.prHourlyLimit) {
    try {
      logger.debug('Calculating hourly PRs remaining');
      const prList = await platform.getPrList();
      const currentHourStart = DateTime.local().startOf('hour');
      logger.debug(`currentHourStart=${String(currentHourStart)}`);
      const soFarThisHour = prList.filter(
        (pr) =>
          pr.sourceBranch !== config.onboardingBranch &&
          pr.sourceBranch.startsWith(config.branchPrefix!) &&
          DateTime.fromISO(pr.createdAt!) > currentHourStart,
      );
      const prsRemaining = Math.max(
        0,
        config.prHourlyLimit - soFarThisHour.length,
      );
      logger.debug(`PR hourly limit remaining: ${prsRemaining}`);
      return prsRemaining;
    } catch (err) {
      // istanbul ignore if
      if (err instanceof ExternalHostError) {
        throw err;
      }
      logger.error({ err }, 'Error checking PRs created per hour');
      return config.prHourlyLimit;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export async function getConcurrentPrsRemaining(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<number> {
  if (config.prConcurrentLimit) {
    logger.debug(`Calculating prConcurrentLimit (${config.prConcurrentLimit})`);
    try {
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
      const concurrentRemaining = Math.max(
        0,
        config.prConcurrentLimit - openPrs.length,
      );
      logger.debug(`PR concurrent limit remaining: ${concurrentRemaining}`);
      return concurrentRemaining;
    } catch (err) /* istanbul ignore next */ {
      logger.error({ err }, 'Error checking concurrent PRs');
      return config.prConcurrentLimit;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export async function getPrsRemaining(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<number> {
  const hourlyRemaining = await getPrHourlyRemaining(config);
  const concurrentRemaining = await getConcurrentPrsRemaining(config, branches);
  return Math.min(hourlyRemaining, concurrentRemaining);
}

export async function getConcurrentBranchesRemaining(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<number> {
  const { branchConcurrentLimit, prConcurrentLimit } = config;
  const limit =
    typeof branchConcurrentLimit === 'number'
      ? branchConcurrentLimit
      : prConcurrentLimit;
  if (typeof limit === 'number' && limit) {
    logger.debug(`Calculating branchConcurrentLimit (${limit})`);
    try {
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

      const concurrentRemaining = Math.max(0, limit - existingCount);
      logger.debug(`Branch concurrent limit remaining: ${concurrentRemaining}`);

      return concurrentRemaining;
    } catch (err) {
      // TODO: #22198 should never throw
      logger.error({ err }, 'Error checking concurrent branches');
      return limit;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export async function getBranchesRemaining(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<number> {
  const hourlyRemaining = await getPrHourlyRemaining(config);
  const concurrentRemaining = await getConcurrentBranchesRemaining(
    config,
    branches,
  );
  return Math.min(hourlyRemaining, concurrentRemaining);
}
