import moment from 'moment';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { RenovateConfig } from '../../../config';
import { BranchConfig } from '../../common';

export type LimitBranchConfig = Pick<BranchConfig, 'branchName'> &
  Partial<BranchConfig>;

export async function getPrHourlyRemaining(
  config: RenovateConfig
): Promise<number> {
  if (config.prHourlyLimit) {
    logger.debug('Calculating hourly PRs remaining');
    const prList = await platform.getPrList();
    const currentHourStart = moment({
      hour: moment().hour(),
    });
    logger.debug('currentHourStart=' + currentHourStart);
    try {
      const soFarThisHour = prList.filter(
        pr =>
          pr.branchName !== config.onboardingBranch &&
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

export async function getConcurrentPrsRemaining(
  config: RenovateConfig,
  branches: LimitBranchConfig[]
): Promise<number> {
  if (config.prConcurrentLimit) {
    logger.debug(`Enforcing prConcurrentLimit (${config.prConcurrentLimit})`);
    let currentlyOpen = 0;
    for (const branch of branches) {
      if (await platform.branchExists(branch.branchName)) {
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
  branches: LimitBranchConfig[]
): Promise<number> {
  const hourlyRemaining = await getPrHourlyRemaining(config);
  const concurrentRemaining = await getConcurrentPrsRemaining(config, branches);
  return hourlyRemaining < concurrentRemaining
    ? hourlyRemaining
    : concurrentRemaining;
}
