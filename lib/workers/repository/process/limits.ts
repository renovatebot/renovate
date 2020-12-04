import { DateTime } from 'luxon';
import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { Pr, platform } from '../../../platform';
import { PrState } from '../../../types';
import { BranchConfig } from '../../common';

export async function getPrHourlyRemaining(
  config: RenovateConfig
): Promise<number> {
  if (config.prHourlyLimit) {
    logger.debug('Calculating hourly PRs remaining');
    const prList = await platform.getPrList();
    const currentHourStart = DateTime.local().startOf('hour');
    logger.debug(`currentHourStart=${String(currentHourStart)}`);
    try {
      const soFarThisHour = prList.filter(
        (pr) =>
          pr.sourceBranch !== config.onboardingBranch &&
          DateTime.fromISO(pr.createdAt) > currentHourStart
      );
      const prsRemaining = config.prHourlyLimit - soFarThisHour.length;
      logger.debug(`PR hourly limit remaining: ${prsRemaining}`);
      // istanbul ignore if
      if (prsRemaining <= 0) {
        logger.debug(
          {
            prs: prsRemaining,
          },
          'Creation of new PRs is blocked by existing PRs'
        );
      }
      return prsRemaining;
    } catch (err) {
      logger.error('Error checking PRs created per hour');
    }
  }
  return 99;
}

export async function getConcurrentPrsRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<number> {
  if (config.prConcurrentLimit) {
    logger.debug(`Calculating prConcurrentLimit (${config.prConcurrentLimit})`);
    try {
      const openPrs: Pr[] = [];
      for (const { branchName } of branches) {
        try {
          const pr = await platform.getBranchPr(branchName);
          if (
            pr &&
            pr.sourceBranch !== config.onboardingBranch &&
            pr.state === PrState.Open
          ) {
            openPrs.push(pr);
          }
        } catch (err) {
          // no-op
        }
      }
      logger.debug(`${openPrs.length} PRs are currently open`);
      const concurrentRemaining = Math.max(
        0,
        config.prConcurrentLimit - openPrs.length
      );
      logger.debug(`PR concurrent limit remaining: ${concurrentRemaining}`);
      return concurrentRemaining;
    } catch (err) /* istanbul ignore next */ {
      logger.error({ err }, 'Error checking concurrent PRs');
      return config.prConcurrentLimit;
    }
  }
  return 99;
}

export async function getPrsRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<number> {
  const hourlyRemaining = await getPrHourlyRemaining(config);
  const concurrentRemaining = await getConcurrentPrsRemaining(config, branches);
  return hourlyRemaining < concurrentRemaining
    ? hourlyRemaining
    : concurrentRemaining;
}
