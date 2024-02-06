import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { Pr, platform } from '../../../../modules/platform';
import { noLeadingAtSymbol } from '../../../../util/common';
import { sampleSize } from '../../../../util/sample';
import { codeOwnersForPr } from './code-owners';

async function addCodeOwners(
  config: RenovateConfig,
  assigneesOrReviewers: string[],
  pr: Pr,
): Promise<string[]> {
  const codeOwners = await codeOwnersForPr(pr);

  const assignees =
    config.expandCodeOwnersGroups && platform.expandGroupMembers
      ? await platform.expandGroupMembers(codeOwners)
      : codeOwners;

  return [...new Set(assigneesOrReviewers.concat(assignees))];
}

function filterUnavailableUsers(
  config: RenovateConfig,
  users: string[],
): Promise<string[]> {
  return config.filterUnavailableUsers && platform.filterUnavailableUsers
    ? platform.filterUnavailableUsers(users)
    : Promise.resolve(users);
}

function prepareParticipants(
  config: RenovateConfig,
  usernames: string[],
): Promise<string[]> {
  const normalizedUsernames = [...new Set(usernames.map(noLeadingAtSymbol))];
  return filterUnavailableUsers(config, normalizedUsernames);
}

export async function addParticipants(
  config: RenovateConfig,
  pr: Pr,
): Promise<void> {
  let assignees = config.assignees ?? [];
  logger.debug(`addParticipants(pr=${pr?.number})`);
  if (config.assigneesFromCodeOwners) {
    assignees = await addCodeOwners(config, assignees, pr);
  }
  if (assignees.length > 0) {
    try {
      assignees = await prepareParticipants(config, assignees);
      if (is.number(config.assigneesSampleSize)) {
        assignees = sampleSize(assignees, config.assigneesSampleSize);
      }
      if (assignees.length > 0) {
        if (GlobalConfig.get('dryRun')) {
          logger.info(`DRY-RUN: Would add assignees to PR #${pr.number}`);
        } else {
          await platform.addAssignees(pr.number, assignees);
          logger.debug({ assignees }, 'Added assignees');
        }
      }
    } catch (err) {
      logger.debug(
        { assignees: config.assignees, err },
        'Failed to add assignees',
      );
    }
  }

  let reviewers = config.reviewers ?? [];
  if (config.reviewersFromCodeOwners) {
    reviewers = await addCodeOwners(config, reviewers, pr);
  }
  if (
    is.array(config.additionalReviewers) &&
    config.additionalReviewers.length > 0
  ) {
    reviewers = reviewers.concat(config.additionalReviewers);
  }
  if (reviewers.length > 0) {
    try {
      reviewers = await prepareParticipants(config, reviewers);
      if (is.number(config.reviewersSampleSize)) {
        reviewers = sampleSize(reviewers, config.reviewersSampleSize);
      }
      if (reviewers.length > 0) {
        if (GlobalConfig.get('dryRun')) {
          logger.info(`DRY-RUN: Would add reviewers to PR #${pr.number}`);
        } else {
          await platform.addReviewers(pr.number, reviewers);
          logger.debug({ reviewers }, 'Added reviewers');
        }
      }
    } catch (err) {
      logger.debug(
        { reviewers: config.reviewers, err },
        'Failed to add reviewers',
      );
    }
  }
}
