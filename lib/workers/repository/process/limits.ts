import moment from 'moment';
import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { PrState } from '../../../types';
import { branchExists } from '../../../util/git';
import { BranchConfig } from '../../common';

export async function getPrHourlyRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<number> {
  if (config.prHourlyLimit) {
    logger.debug('Calculating hourly PRs remaining');
    try {
      const branchList = branches.map(({ branchName }) => branchName);
      const prList = await platform.getPrList();
      const currentHourStart = moment({
        hour: moment().hour(),
      });
      logger.debug(`currentHourStart=${String(currentHourStart)}`);
      const soFarThisHour = prList.filter(
        (pr) =>
          pr.sourceBranch !== config.onboardingBranch &&
          branchList.includes(pr.sourceBranch) &&
          moment(pr.createdAt).isAfter(currentHourStart)
      );
      const prsRemaining = Math.max(
        0,
        config.prHourlyLimit - soFarThisHour.length
      );
      logger.debug(`PR hourly limit remaining: ${prsRemaining}`);
      return prsRemaining;
    } catch (err) {
      logger.error({ err }, 'Error checking PRs created per hour');
      return config.prHourlyLimit;
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
      const branchList = branches.map(({ branchName }) => branchName);
      const prList = await platform.getPrList();
      const openPrs = prList.filter(
        (pr) =>
          pr.state === PrState.Open &&
          pr.sourceBranch !== config.onboardingBranch &&
          branchList.includes(pr.sourceBranch)
      );
      logger.debug(`${openPrs.length} PRs are currently open`);
      const concurrentRemaining = Math.max(
        0,
        config.prConcurrentLimit - openPrs.length
      );
      logger.debug(`PR concurrent limit remaining: ${concurrentRemaining}`);
      return concurrentRemaining;
    } catch (err) {
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
  const hourlyRemaining = await getPrHourlyRemaining(config, branches);
  const concurrentRemaining = await getConcurrentPrsRemaining(config, branches);
  return hourlyRemaining < concurrentRemaining
    ? hourlyRemaining
    : concurrentRemaining;
}

export function getConcurrentBranchesRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): number {
  const { branchConcurrentLimit, prConcurrentLimit } = config;
  const limit =
    typeof branchConcurrentLimit === 'number'
      ? branchConcurrentLimit
      : prConcurrentLimit;
  if (typeof limit === 'number' && limit) {
    logger.debug(`Calculating branchConcurrentLimit (${limit})`);
    try {
      let currentlyOpen = 0;
      for (const branch of branches) {
        if (branchExists(branch.branchName)) {
          currentlyOpen += 1;
        }
      }
      logger.debug(`${currentlyOpen} branches are currently open`);
      const concurrentRemaining = Math.max(0, limit - currentlyOpen);
      logger.debug(`Branch concurrent limit remaining: ${concurrentRemaining}`);
      return concurrentRemaining;
    } catch (err) {
      logger.error({ err }, 'Error checking concurrent branches');
      return limit;
    }
  }
  return 99;
}

export function getBranchesRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): number {
  return getConcurrentBranchesRemaining(config, branches);
}
