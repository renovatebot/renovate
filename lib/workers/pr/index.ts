import { getAdminConfig } from '../../config/admin';
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
import { deleteBranch, getBranchLastCommitTime } from '../../util/git';
import * as template from '../../util/template';
import { Limit, incLimitedValue, isLimitReached } from '../global/limits';
import { BranchConfig, PrResult } from '../types';
import { getPrBody } from './body';
import { ChangeLogError } from './changelog/types';
import { codeOwnersForPr } from './code-owners';

function noWhitespaceOrHeadings(input: string): string {
  return input.replace(/\r?\n|\r|\s|#/g, '');
}

function noLeadingAtSymbol(input: string): string {
  return input.length && input.startsWith('@') ? input.slice(1) : input;
}

async function addCodeOwners(
  assigneesOrReviewers: string[],
  pr: Pr
): Promise<string[]> {
  return [...new Set(assigneesOrReviewers.concat(await codeOwnersForPr(pr)))];
}

export async function addAssigneesReviewers(
  config: RenovateConfig,
  pr: Pr
): Promise<void> {
  let assignees = config.assignees;
  if (config.assigneesFromCodeOwners) {
    assignees = await addCodeOwners(assignees, pr);
  }
  if (assignees.length > 0) {
    try {
      assignees = assignees.map(noLeadingAtSymbol);
      if (config.assigneesSampleSize !== null) {
        assignees = sampleSize(assignees, config.assigneesSampleSize);
      }
      if (assignees.length > 0) {
        // istanbul ignore if
        if (getAdminConfig().dryRun) {
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
      reviewers = [...new Set(reviewers.map(noLeadingAtSymbol))];
      if (config.reviewersSampleSize !== null) {
        reviewers = sampleSize(reviewers, config.reviewersSampleSize);
      }
      if (reviewers.length > 0) {
        // istanbul ignore if
        if (getAdminConfig().dryRun) {
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
  return {
    azureAutoComplete: config.azureAutoComplete,
    azureWorkItemId: config.azureWorkItemId,
    bbUseDefaultReviewers: config.bbUseDefaultReviewers,
    gitLabAutomerge:
      config.automerge &&
      config.automergeType === 'pr' &&
      config.gitLabAutomerge,
  };
}
export type EnsurePrResult = {
  prResult: PrResult;
  pr?: Pr;
};

// Ensures that PR exists with matching title/body
export async function ensurePr(
  prConfig: BranchConfig
): Promise<EnsurePrResult> {
  const config: BranchConfig = { ...prConfig };

  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const { branchName, prTitle, upgrades } = config;
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

  let branchStatus: BranchStatus;
  async function getBranchStatus(): Promise<BranchStatus> {
    if (!branchStatus) {
      branchStatus = await platform.getBranchStatus(
        branchName,
        config.requiredStatusChecks
      );
      logger.debug({ branchStatus, branchName }, 'getBranchStatus() result');
    }
    return branchStatus;
  }

  // Only create a PR if a branch automerge has failed
  if (
    config.automerge === true &&
    config.automergeType.startsWith('branch') &&
    !config.forcePr
  ) {
    logger.debug(
      `Branch is configured for branch automerge, branch status) is: ${await getBranchStatus()}`
    );
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
      return { prResult: PrResult.BlockedByBranchAutomerge };
    }
  }
  if (config.prCreation === 'status-success') {
    logger.debug('Checking branch combined status');
    if ((await getBranchStatus()) !== BranchStatus.green) {
      logger.debug(
        `Branch status is "${await getBranchStatus()}" - not creating PR`
      );
      return { prResult: PrResult.AwaitingGreenBranch };
    }
    logger.debug('Branch status success');
  } else if (
    config.prCreation === 'approval' &&
    !existingPr &&
    dependencyDashboardCheck !== 'approvePr'
  ) {
    return { prResult: PrResult.AwaitingApproval };
  } else if (
    config.prCreation === 'not-pending' &&
    !existingPr &&
    !config.forcePr
  ) {
    logger.debug('Checking branch combined status');
    if ((await getBranchStatus()) === BranchStatus.yellow) {
      logger.debug(
        `Branch status is "${await getBranchStatus()}" - checking timeout`
      );
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
        return { prResult: PrResult.AwaitingNotPending };
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

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depType}-${upgrade.depName}-${
      upgrade.manager
    }-${upgrade.currentVersion || upgrade.currentValue}-${upgrade.newVersion}`;
    if (processedUpgrades.includes(upgradeKey)) {
      continue; // eslint-disable-line no-continue
    }
    processedUpgrades.push(upgradeKey);

    const logJSON = upgrade.logJSON;

    if (logJSON) {
      if (typeof logJSON.error === 'undefined') {
        if (logJSON.project) {
          upgrade.repoName = logJSON.project.github
            ? logJSON.project.github
            : logJSON.project.gitlab;
        }
        upgrade.hasReleaseNotes = logJSON.hasReleaseNotes;
        upgrade.releases = [];
        if (
          upgrade.hasReleaseNotes &&
          upgrade.repoName &&
          !commitRepos.includes(upgrade.repoName)
        ) {
          commitRepos.push(upgrade.repoName);
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
            'If you are using the hosted GitLab app, please follow [this guide](https://docs.renovatebot.com/install-gitlab-app/#configuring-a-token-for-githubcom-hosted-release-notes). If you are self-hosted, please see [this instruction](https://github.com/renovatebot/renovate/blob/master/docs/usage/self-hosting.md#githubcom-token-for-release-notes) instead.',
            '\n',
          ].join('\n'),
        ];
      }
    }
    config.upgrades.push(upgrade);
  }

  config.hasReleaseNotes = config.upgrades.some((upg) => upg.hasReleaseNotes);

  const releaseNoteRepos: string[] = [];
  for (const upgrade of config.upgrades) {
    if (upgrade.hasReleaseNotes) {
      if (releaseNoteRepos.includes(upgrade.sourceUrl)) {
        logger.debug(
          { depName: upgrade.depName },
          'Removing duplicate release notes'
        );
        upgrade.hasReleaseNotes = false;
      } else {
        releaseNoteRepos.push(upgrade.sourceUrl);
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
      existingPrBody = existingPrBody.trim();
      if (
        existingPr.title === prTitle &&
        noWhitespaceOrHeadings(existingPrBody) ===
          noWhitespaceOrHeadings(prBody)
      ) {
        logger.debug(`${existingPr.displayNumber} does not need updating`);
        return { prResult: PrResult.NotUpdated, pr: existingPr };
      }
      // PR must need updating
      if (existingPr.title !== prTitle) {
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
      if (getAdminConfig().dryRun) {
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
      return { prResult: PrResult.Updated, pr: existingPr };
    }
    logger.debug({ branch: branchName, prTitle }, `Creating PR`);
    // istanbul ignore if
    if (config.updateType === 'rollback') {
      logger.info('Creating Rollback PR');
    }
    let pr: Pr;
    try {
      // istanbul ignore if
      if (getAdminConfig().dryRun) {
        logger.info('DRY-RUN: Would create PR: ' + prTitle);
        pr = { number: 0, displayNumber: 'Dry run PR' } as never;
      } else {
        if (
          !dependencyDashboardCheck &&
          isLimitReached(Limit.PullRequests) &&
          !config.isVulnerabilityAlert
        ) {
          logger.debug('Skipping PR - limit reached');
          return { prResult: PrResult.LimitReached };
        }
        pr = await platform.createPr({
          sourceBranch: branchName,
          targetBranch: config.baseBranch,
          prTitle,
          prBody,
          labels: [
            ...new Set([...config.labels, ...config.addLabels]),
          ].map((label) => template.compile(label, config)),
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
        return { prResult: PrResult.ErrorAlreadyExists };
      }
      if (err.statusCode === 502) {
        logger.warn(
          { branch: branchName },
          'Deleting branch due to server error'
        );
        if (getAdminConfig().dryRun) {
          logger.info('DRY-RUN: Would delete branch: ' + config.branchName);
        } else {
          await deleteBranch(branchName);
        }
      }
      return { prResult: PrResult.Error };
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
      if (getAdminConfig().dryRun) {
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
    return { prResult: PrResult.Created, pr };
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
  return { prResult: PrResult.Error };
}
