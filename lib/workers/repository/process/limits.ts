import moment from 'moment';
import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { branchExists } from '../../../util/git';
import { BranchConfig } from '../../common';

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
          pr.sourceBranch !== config.onboardingBranch &&
          moment(pr.createdAt).isAfter(currentHourStart)
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

export function getConcurrentPrsRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): number {
  if (config.prConcurrentLimit) {
    logger.debug(`Enforcing prConcurrentLimit (${config.prConcurrentLimit})`);
    let currentlyOpen = 0;
    for (const branch of branches) {
      if (branchExists(branch.branchName)) {
        currentlyOpen += 1;
      }
    }
    logger.debug(`${currentlyOpen} PRs are currently open`);
    const concurrentRemaining = config.prConcurrentLimit - currentlyOpen;
    logger.debug(`PR concurrent limit remaining: ${concurrentRemaining}`);
    return concurrentRemaining;
  }
  return 99;
}

export async function getPrsRemaining(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<number> {
  const hourlyRemaining = await getPrHourlyRemaining(config);
  const concurrentRemaining = getConcurrentPrsRemaining(config, branches);
  return hourlyRemaining < concurrentRemaining
    ? hourlyRemaining
    : concurrentRemaining;
}
