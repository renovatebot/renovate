import moment from 'moment';
import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { PrState } from '../../../types';
import { getBranchList } from '../../../util/git';

export async function getPrHourlyRemaining(
  config: RenovateConfig
): Promise<number> {
  if (config.prHourlyLimit) {
    logger.debug('Calculating hourly PRs remaining');
    const prList = await platform.getPrList();
    const currentHourStart = moment({
      hour: moment().hour(),
    });
    logger.debug(`currentHourStart=${String(currentHourStart)}`);
    try {
      const soFarThisHour = prList.filter(
        (pr) =>
          pr.branchName !== config.onboardingBranch &&
          moment(pr.createdAt).isAfter(currentHourStart)
      );
      const prsRemaining = Math.max(
        0,
        config.prHourlyLimit - soFarThisHour.length
      );
      logger.debug(`PR hourly limit remaining: ${prsRemaining}`);
      return prsRemaining;
    } catch (err) {
      logger.error('Error checking PRs created per hour');
    }
  }
  return 99;
}

export async function getConcurrentPrsRemaining(
  config: RenovateConfig
): Promise<number> {
  if (config.prConcurrentLimit) {
    logger.debug(`Calculating prConcurrentLimit (${config.prConcurrentLimit})`);
    try {
      const prList = await platform.getPrList();
      const openPrs = prList.filter(
        (pr) =>
          pr.state === PrState.Open && pr.branchName !== config.onboardingBranch
      );
      logger.debug(`${openPrs.length} PRs are currently open`);
      const concurrentRemaining = Math.max(
        0,
        config.prConcurrentLimit - openPrs.length
      );
      logger.debug(`PR concurrent limit remaining: ${concurrentRemaining}`);
      return concurrentRemaining;
    } catch (err) {
      logger.error('Error checking concurrent PRs');
    }
  }
  return 99;
}

export async function getPrsRemaining(config: RenovateConfig): Promise<number> {
  const hourlyRemaining = await getPrHourlyRemaining(config);
  const concurrentRemaining = await getConcurrentPrsRemaining(config);
  return hourlyRemaining < concurrentRemaining
    ? hourlyRemaining
    : concurrentRemaining;
}

export function getConcurrentBranchesRemaining(config: RenovateConfig): number {
  const { branchConcurrentLimit, prConcurrentLimit } = config;
  const limit =
    typeof branchConcurrentLimit === 'number'
      ? branchConcurrentLimit
      : prConcurrentLimit;
  if (typeof limit === 'number' && limit) {
    logger.debug(`Calculating branchConcurrentLimit (${limit})`);
    const renovateBranches = getBranchList()?.filter(
      (branchName) =>
        branchName.startsWith(config.branchPrefix) &&
        branchName !== config.onboardingBranch
    );
    const currentlyCreated = renovateBranches.length;
    logger.debug(`${currentlyCreated} branches are currently created`);
    const concurrentRemaining = Math.max(0, limit - currentlyCreated);
    logger.debug(`Branch concurrent limit remaining: ${concurrentRemaining}`);
    return concurrentRemaining;
  }
  return 99;
}

export function getBranchesRemaining(config: RenovateConfig): number {
  return getConcurrentBranchesRemaining(config);
}
