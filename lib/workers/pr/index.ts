import is from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global';
import type { RenovateConfig } from '../../config/types';
import {
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { PlatformPrOptions, Pr, platform } from '../../platform';
import { BranchStatus } from '../../types';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { sampleSize } from '../../util';
import { stripEmojis } from '../../util/emoji';
import { deleteBranch, getBranchLastCommitTime } from '../../util/git';
import { regEx } from '../../util/regex';
import * as template from '../../util/template';
import { resolveBranchStatus } from '../branch/status-checks';
import { Limit, incLimitedValue, isLimitReached } from '../global/limits';
import type { BranchConfig, BranchUpgradeConfig, PrBlockedBy } from '../types';
import { getPrBody } from './body';
import { ChangeLogError } from './changelog/types';
import { codeOwnersForPr } from './code-owners';

function noWhitespaceOrHeadings(input: string): string {
  return input.replace(regEx(/\r?\n|\r|\s|#/g), '');
}

function noLeadingAtSymbol(input: string): string {
  return input.length && input.startsWith('@') ? input.slice(1) : input;
}

function nonEmptyStringAndNotWhitespace(input: string): boolean {
  return is.nonEmptyString(input) && !is.emptyStringOrWhitespace(input);
}

async function addCodeOwners(
  assigneesOrReviewers: string[],
  pr: Pr
): Promise<string[]> {
  return [...new Set(assigneesOrReviewers.concat(await codeOwnersForPr(pr)))];
}

function filterUnavailableUsers(
  config: RenovateConfig,
  users: string[]
): Promise<string[]> {
  return config.filterUnavailableUsers && platform.filterUnavailableUsers
    ? platform.filterUnavailableUsers(users)
    : Promise.resolve(users);
}

function prepareAssigneesReviewers(
  config: RenovateConfig,
  usernames: string[]
): Promise<string[]> {
  const normalizedUsernames = [...new Set(usernames.map(noLeadingAtSymbol))];
  return filterUnavailableUsers(config, normalizedUsernames);
}

export function prepareLabels(config: RenovateConfig): string[] {
  const labels = config.labels ?? [];
  const addLabels = config.addLabels ?? [];
  return [...new Set([...labels, ...addLabels])]
    .filter(nonEmptyStringAndNotWhitespace)
    .map((label) => template.compile(label, config))
    .filter(nonEmptyStringAndNotWhitespace);
}

export async function addAssigneesReviewers(
  config: RenovateConfig,
  pr: Pr
): Promise<void> {
  let assignees = config.assignees;
  logger.debug(`addAssigneesReviewers(pr=${pr?.number})`);
  if (config.assigneesFromCodeOwners) {
    assignees = await addCodeOwners(assignees, pr);
  }
  if (assignees.length > 0) {
    try {
      assignees = await prepareAssigneesReviewers(config, assignees);
      if (config.assigneesSampleSize !== null) {
        assignees = sampleSize(assignees, config.assigneesSampleSize);
      }
      if (assignees.length > 0) {
        // istanbul ignore if
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
        'Failed to add assignees'
      );
    }
  }
  let reviewers = config.reviewers;
  if (config.reviewersFromCodeOwners) {
    reviewers = await addCodeOwners(reviewers, pr);
  }
  if (config.additionalReviewers.length > 0) {
    reviewers = reviewers.concat(config.additionalReviewers);
  }
  if (reviewers.length > 0) {
    try {
      reviewers = await prepareAssigneesReviewers(config, reviewers);
      if (config.reviewersSampleSize !== null) {
        reviewers = sampleSize(reviewers, config.reviewersSampleSize);
      }
      if (reviewers.length > 0) {
        // istanbul ignore if
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
        'Failed to add reviewers'
      );
    }
  }
}

export function getPlatformPrOptions(
  config: RenovateConfig & PlatformPrOptions
): PlatformPrOptions {
  const usePlatformAutomerge = Boolean(
    config.automerge &&
      (config.automergeType === 'pr' || config.automergeType === 'branch') &&
      config.platformAutomerge
  );

  return {
    azureAutoApprove: config.azureAutoApprove,
    azureWorkItemId: config.azureWorkItemId,
    bbUseDefaultReviewers: config.bbUseDefaultReviewers,
    gitLabIgnoreApprovals: config.gitLabIgnoreApprovals,
    usePlatformAutomerge,
  };
}

export type ResultWithPr = {
  pr: Pr;
  prBlockedBy?: never;
};

export type ResultWithoutPr = {
  pr?: never;
  prBlockedBy: PrBlockedBy;
};

export type EnsurePrResult = ResultWithPr | ResultWithoutPr;

// Ensures that PR exists with matching title/body
export async function ensurePr(
  prConfig: BranchConfig
): Promise<EnsurePrResult> {
  let branchStatus: BranchStatus;
  async function getBranchStatus(): Promise<BranchStatus> {
    if (branchStatus) {
      return branchStatus;
    }
    branchStatus = await resolveBranchStatus(branchName, ignoreTests);
    logger.debug(`Branch status is: ${branchStatus}`);
    return branchStatus;
  }

  const config: BranchConfig = { ...prConfig };

  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const { branchName, ignoreTests, prTitle, upgrades } = config;
  const dependencyDashboardCheck = (config.dependencyDashboardChecks || {})[
    config.branchName
  ];
  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(branchName);
  if (existingPr) {
    logger.debug('Found existing PR');
  }
  config.upgrades = [];

  if (config.artifactErrors?.length) {
    logger.debug('Forcing PR because of artifact errors');
    config.forcePr = true;
  }

  // Only create a PR if a branch automerge has failed
  if (
    config.automerge === true &&
    config.automergeType.startsWith('branch') &&
    !config.forcePr
  ) {
    logger.debug(`Branch automerge is enabled`);
    if (
      config.stabilityStatus !== BranchStatus.yellow &&
      (await getBranchStatus()) === BranchStatus.yellow
    ) {
      logger.debug('Checking how long this branch has been pending');
      const lastCommitTime = await getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (elapsedHours >= config.prNotPendingHours) {
        logger.debug('Branch exceeds prNotPending hours - forcing PR creation');
        config.forcePr = true;
      }
    }
    if (config.forcePr || (await getBranchStatus()) === BranchStatus.red) {
      logger.debug(`Branch tests failed, so will create PR`);
    } else {
      // Branch should be automerged, so we don't want to create a PR
      return { prBlockedBy: 'BranchAutomerge' };
    }
  }
  if (config.prCreation === 'status-success') {
    logger.debug('Checking branch combined status');
    if ((await getBranchStatus()) !== BranchStatus.green) {
      logger.debug(`Branch status isn't green - not creating PR`);
      return { prBlockedBy: 'AwaitingTests' };
    }
    logger.debug('Branch status success');
  } else if (
    config.prCreation === 'approval' &&
    !existingPr &&
    dependencyDashboardCheck !== 'approvePr'
  ) {
    return { prBlockedBy: 'NeedsApproval' };
  } else if (
    config.prCreation === 'not-pending' &&
    !existingPr &&
    !config.forcePr
  ) {
    logger.debug('Checking branch combined status');
    if ((await getBranchStatus()) === BranchStatus.yellow) {
      logger.debug(`Branch status is yellow - checking timeout`);
      const lastCommitTime = await getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (
        !dependencyDashboardCheck &&
        ((config.stabilityStatus &&
          config.stabilityStatus !== BranchStatus.yellow) ||
          elapsedHours < config.prNotPendingHours)
      ) {
        logger.debug(
          `Branch is ${elapsedHours} hours old - skipping PR creation`
        );
        return {
          prBlockedBy: 'AwaitingTests',
        };
      }
      const prNotPendingHours = String(config.prNotPendingHours);
      logger.debug(
        `prNotPendingHours=${prNotPendingHours} threshold hit - creating PR`
      );
    }
    logger.debug('Branch status success');
  }

  const processedUpgrades: string[] = [];
  const commitRepos: string[] = [];

  function getRepoNameWithSourceDirectory(
    upgrade: BranchUpgradeConfig
  ): string {
    return `${upgrade.repoName}${
      upgrade.sourceDirectory ? `:${upgrade.sourceDirectory}` : ''
    }`;
  }

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depType}-${upgrade.depName}-${
      upgrade.manager
    }-${upgrade.currentVersion || upgrade.currentValue}-${upgrade.newVersion}`;
    if (processedUpgrades.includes(upgradeKey)) {
      continue;
    }
    processedUpgrades.push(upgradeKey);

    const logJSON = upgrade.logJSON;

    if (logJSON) {
      if (typeof logJSON.error === 'undefined') {
        if (logJSON.project) {
          upgrade.repoName = logJSON.project.repository;
        }
        upgrade.hasReleaseNotes = false;
        upgrade.releases = [];
        if (
          logJSON.hasReleaseNotes &&
          upgrade.repoName &&
          !commitRepos.includes(getRepoNameWithSourceDirectory(upgrade))
        ) {
          commitRepos.push(getRepoNameWithSourceDirectory(upgrade));
          upgrade.hasReleaseNotes = logJSON.hasReleaseNotes;
          if (logJSON.versions) {
            logJSON.versions.forEach((version) => {
              const release = { ...version };
              upgrade.releases.push(release);
            });
          }
        }
      } else if (logJSON.error === ChangeLogError.MissingGithubToken) {
        upgrade.prBodyNotes = [
          ...upgrade.prBodyNotes,
          [
            '\n',
            ':warning: Release Notes retrieval for this PR were skipped because no github.com credentials were available.',
            'If you are self-hosted, please see [this instruction](https://github.com/renovatebot/renovate/blob/master/docs/usage/examples/self-hosting.md#githubcom-token-for-release-notes).',
            '\n',
          ].join('\n'),
        ];
      }
    }
    config.upgrades.push(upgrade);
  }

  config.hasReleaseNotes = config.upgrades.some((upg) => upg.hasReleaseNotes);

  const releaseNotesSources: string[] = [];
  for (const upgrade of config.upgrades) {
    let notesSourceUrl = upgrade.releases?.[0]?.releaseNotes?.notesSourceUrl;
    if (!notesSourceUrl) {
      notesSourceUrl = `${upgrade.sourceUrl}${
        upgrade.sourceDirectory ? `:${upgrade.sourceDirectory}` : ''
      }`;
    }

    if (upgrade.hasReleaseNotes && notesSourceUrl) {
      if (releaseNotesSources.includes(notesSourceUrl)) {
        logger.debug(
          { depName: upgrade.depName },
          'Removing duplicate release notes'
        );
        upgrade.hasReleaseNotes = false;
      } else {
        releaseNotesSources.push(notesSourceUrl);
      }
    }
  }

  const prBody = await getPrBody(config);

  try {
    if (existingPr) {
      logger.debug('Processing existing PR');
      // istanbul ignore if
      if (
        !existingPr.hasAssignees &&
        !existingPr.hasReviewers &&
        config.automerge &&
        !config.assignAutomerge &&
        (await getBranchStatus()) === BranchStatus.red
      ) {
        logger.debug(`Setting assignees and reviewers as status checks failed`);
        await addAssigneesReviewers(config, existingPr);
      }
      // Check if existing PR needs updating
      const reviewableIndex = existingPr.body.indexOf(
        '<!-- Reviewable:start -->'
      );
      let existingPrBody = existingPr.body;
      if (reviewableIndex > -1) {
        logger.debug('Stripping Reviewable content');
        existingPrBody = existingPrBody.slice(0, reviewableIndex);
      }
      const existingPrTitle = stripEmojis(existingPr.title);
      const newPrTitle = stripEmojis(prTitle);
      existingPrBody = existingPrBody.trim();
      if (
        existingPrTitle === newPrTitle &&
        noWhitespaceOrHeadings(stripEmojis(existingPrBody)) ===
          noWhitespaceOrHeadings(stripEmojis(prBody))
      ) {
        logger.debug(`${existingPr.displayNumber} does not need updating`);
        return { pr: existingPr };
      }
      // PR must need updating
      if (existingPrTitle !== newPrTitle) {
        logger.debug(
          {
            branchName,
            oldPrTitle: existingPr.title,
            newPrTitle: prTitle,
          },
          'PR title changed'
        );
      } else if (!config.committedFiles && !config.rebaseRequested) {
        logger.debug(
          {
            prTitle,
          },
          'PR body changed'
        );
      }
      // istanbul ignore if
      if (GlobalConfig.get('dryRun')) {
        logger.info(`DRY-RUN: Would update PR #${existingPr.number}`);
      } else {
        await platform.updatePr({
          number: existingPr.number,
          prTitle,
          prBody,
          platformOptions: getPlatformPrOptions(config),
        });
        logger.info({ pr: existingPr.number, prTitle }, `PR updated`);
      }
      return {
        pr: existingPr,
      };
    }
    logger.debug({ branch: branchName, prTitle }, `Creating PR`);
    // istanbul ignore if
    if (config.updateType === 'rollback') {
      logger.info('Creating Rollback PR');
    }
    let pr: Pr;
    try {
      // istanbul ignore if
      if (GlobalConfig.get('dryRun')) {
        logger.info('DRY-RUN: Would create PR: ' + prTitle);
        pr = { number: 0, displayNumber: 'Dry run PR' } as never;
      } else {
        if (
          !dependencyDashboardCheck &&
          isLimitReached(Limit.PullRequests) &&
          !config.isVulnerabilityAlert
        ) {
          logger.debug('Skipping PR - limit reached');
          return { prBlockedBy: 'RateLimited' };
        }
        pr = await platform.createPr({
          sourceBranch: branchName,
          targetBranch: config.baseBranch,
          prTitle,
          prBody,
          labels: prepareLabels(config),
          platformOptions: getPlatformPrOptions(config),
          draftPR: config.draftPR,
        });
        incLimitedValue(Limit.PullRequests);
        logger.info({ pr: pr.number, prTitle }, 'PR created');
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Pull request creation error');
      if (
        err.body?.message === 'Validation failed' &&
        err.body.errors?.length &&
        err.body.errors.some((error: { message?: string }) =>
          error.message?.startsWith('A pull request already exists')
        )
      ) {
        logger.warn('A pull requests already exists');
        return { prBlockedBy: 'Error' };
      }
      if (err.statusCode === 502) {
        logger.warn(
          { branch: branchName },
          'Deleting branch due to server error'
        );
        if (GlobalConfig.get('dryRun')) {
          logger.info('DRY-RUN: Would delete branch: ' + config.branchName);
        } else {
          await deleteBranch(branchName);
        }
      }
      return { prBlockedBy: 'Error' };
    }
    if (
      config.branchAutomergeFailureMessage &&
      !config.suppressNotifications.includes('branchAutomergeFailure')
    ) {
      const topic = 'Branch automerge failure';
      let content =
        'This PR was configured for branch automerge, however this is not possible so it has been raised as a PR instead.';
      if (config.branchAutomergeFailureMessage === 'branch status error') {
        content += '\n___\n * Branch has one or more failed status checks';
      }
      content = platform.massageMarkdown(content);
      logger.debug('Adding branch automerge failure message to PR');
      // istanbul ignore if
      if (GlobalConfig.get('dryRun')) {
        logger.info(`DRY-RUN: Would add comment to PR #${pr.number}`);
      } else {
        await platform.ensureComment({
          number: pr.number,
          topic,
          content,
        });
      }
    }
    // Skip assign and review if automerging PR
    if (
      config.automerge &&
      !config.assignAutomerge &&
      (await getBranchStatus()) !== BranchStatus.red
    ) {
      logger.debug(
        `Skipping assignees and reviewers as automerge=${config.automerge}`
      );
    } else {
      await addAssigneesReviewers(config, pr);
    }
    logger.debug(`Created ${pr.displayNumber}`);
    return { pr };
  } catch (err) {
    // istanbul ignore if
    if (
      err instanceof ExternalHostError ||
      err.message === REPOSITORY_CHANGED ||
      err.message === PLATFORM_RATE_LIMIT_EXCEEDED ||
      err.message === PLATFORM_INTEGRATION_UNAUTHORIZED
    ) {
      logger.debug('Passing error up');
      throw err;
    }
    logger.error({ err }, 'Failed to ensure PR: ' + prTitle);
  }
  if (existingPr) {
    return { pr: existingPr };
  }
  // istanbul ignore next
  return { prBlockedBy: 'Error' };
}
