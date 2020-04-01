import sampleSize from 'lodash/sampleSize';
import uniq from 'lodash/uniq';
import { logger } from '../../logger';
import { ChangeLogError, getChangeLogJSON } from './changelog';
import { getPrBody } from './body';
import { platform, Pr, PlatformPrOptions } from '../../platform';
import { BranchConfig, PrResult } from '../common';
import {
  PLATFORM_FAILURE,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { BranchStatus } from '../../types';

function noWhitespace(input: string): string {
  return input.replace(/\r?\n|\r|\s/g, '');
}

function noLeadingAtSymbol(input: string): string {
  return input.length && input.startsWith('@') ? input.slice(1) : input;
}

export async function addAssigneesReviewers(config, pr: Pr): Promise<void> {
  if (config.assignees.length > 0) {
    try {
      let assignees = config.assignees.map(noLeadingAtSymbol);
      if (config.assigneesSampleSize !== null) {
        assignees = sampleSize(assignees, config.assigneesSampleSize);
      }
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would add assignees to PR #' + pr.number);
      } else {
        await platform.addAssignees(pr.number, assignees);
        logger.debug({ assignees }, 'Added assignees');
      }
    } catch (err) {
      logger.debug(
        { assignees: config.assignees, err },
        'Failed to add assignees'
      );
    }
  }
  if (config.reviewers.length > 0) {
    try {
      let reviewers = config.reviewers.map(noLeadingAtSymbol);
      if (config.additionalReviewers.length > 0) {
        const additionalReviewers = config.additionalReviewers.map(
          noLeadingAtSymbol
        );
        reviewers = uniq(reviewers.concat(additionalReviewers));
      }
      if (config.reviewersSampleSize !== null) {
        reviewers = sampleSize(reviewers, config.reviewersSampleSize);
      }
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would add reviewers to PR #' + pr.number);
      } else {
        await platform.addReviewers(pr.number, reviewers);
        logger.debug({ reviewers }, 'Added reviewers');
      }
    } catch (err) {
      logger.debug(
        { reviewers: config.reviewers, err },
        'Failed to add reviewers'
      );
    }
  }
}

// Ensures that PR exists with matching title/body
export async function ensurePr(
  prConfig: BranchConfig
): Promise<{
  prResult: PrResult;
  pr?: Pr;
}> {
  const config: BranchConfig = { ...prConfig };

  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const { branchName, prTitle, upgrades } = config;
  const masterIssueCheck = (config.masterIssueChecks || {})[config.branchName];
  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(branchName);
  if (existingPr) {
    logger.debug('Found existing PR');
  }
  config.upgrades = [];

  if (config.artifactErrors && config.artifactErrors.length) {
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
    if ((await getBranchStatus()) === BranchStatus.yellow) {
      logger.debug('Checking how long this branch has been pending');
      const lastCommitTime = await platform.getBranchLastCommitTime(branchName);
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
      return { prResult: PrResult.BlockeddByBranchAutomerge };
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
    masterIssueCheck !== 'approvePr'
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
      const lastCommitTime = await platform.getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (!masterIssueCheck && elapsedHours < config.prNotPendingHours) {
        logger.debug(
          `Branch is ${elapsedHours} hours old - skipping PR creation`
        );
        return { prResult: PrResult.AwaitingNotPending };
      }
      logger.debug(
        `prNotPendingHours=${config.prNotPendingHours} threshold hit - creating PR`
      );
    }
    logger.debug('Branch status success');
  }

  const processedUpgrades = [];
  const commitRepos = [];

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depType}-${upgrade.depName}-${
      upgrade.manager
    }-${upgrade.fromVersion || upgrade.currentValue}-${upgrade.toVersion}`;
    if (processedUpgrades.includes(upgradeKey)) {
      continue; // eslint-disable-line no-continue
    }
    processedUpgrades.push(upgradeKey);
    upgrade.hasUrls = !!(upgrade.sourceUrl || upgrade.homepage);

    const logJSON = await getChangeLogJSON(upgrade);

    if (logJSON) {
      if (typeof logJSON.error === 'undefined') {
        if (logJSON.project) {
          upgrade.githubName = logJSON.project.github;
        }
        upgrade.hasReleaseNotes = logJSON.hasReleaseNotes;
        upgrade.releases = [];
        if (
          upgrade.hasReleaseNotes &&
          upgrade.githubName &&
          !commitRepos.includes(upgrade.githubName)
        ) {
          commitRepos.push(upgrade.githubName);
          if (logJSON.versions) {
            logJSON.versions.forEach(version => {
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
            'To add credentials for github.com to your config, please see [this guide](https://docs.renovatebot.com/install-gitlab-app/#configuring-a-token-for-githubcom-hosted-release-notes).',
            '\n',
          ].join('\n'),
        ];
      }
    }
    config.upgrades.push(upgrade);
  }

  // Update the config object
  Object.assign(config, upgrades[0]);
  config.hasReleaseNotes = config.upgrades.some(upg => upg.hasReleaseNotes);

  const releaseNoteRepos = [];
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
      if (config.automerge && (await getBranchStatus()) === BranchStatus.red) {
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
        noWhitespace(existingPrBody) === noWhitespace(prBody)
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
      } else if (!config.committedFiles) {
        logger.debug(
          {
            prTitle,
          },
          'PR body changed'
        );
        logger.trace(
          {
            prTitle,
            oldPrBody: existingPrBody,
            newPrBody: prBody,
          },
          'PR body changed'
        );
      }
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would update PR #' + existingPr.number);
      } else {
        await platform.updatePr(existingPr.number, prTitle, prBody);
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
      if (config.dryRun) {
        logger.info('DRY-RUN: Would create PR: ' + prTitle);
        pr = { number: 0, displayNumber: 'Dry run PR' } as never;
      } else {
        const platformOptions: PlatformPrOptions = {
          azureAutoComplete: config.azureAutoComplete,
          statusCheckVerify: config.statusCheckVerify,
          gitLabAutomerge:
            config.automerge &&
            config.automergeType === 'pr' &&
            config.gitLabAutomerge,
        };
        pr = await platform.createPr({
          branchName,
          prTitle,
          prBody,
          labels: config.labels,
          useDefaultBranch: false,
          platformOptions,
        });
        logger.info({ pr: pr.number, prTitle }, 'PR created');
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Pull request creation error');
      if (err.body && err.body.message === 'Validation failed') {
        if (err.body.errors && err.body.errors.length) {
          if (
            err.body.errors.some(
              error =>
                error.message &&
                error.message.startsWith('A pull request already exists')
            )
          ) {
            logger.warn('A pull requests already exists');
            return { prResult: PrResult.ErrorAlreadyExists };
          }
        }
      }
      if (err.statusCode === 502) {
        logger.warn(
          { branch: branchName },
          'Deleting branch due to server error'
        );
        if (config.dryRun) {
          logger.info('DRY-RUN: Would delete branch: ' + config.branchName);
        } else {
          await platform.deleteBranch(branchName);
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
      logger.debug('Adding branch automerge failure message to PR');
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Would add comment to PR #' + pr.number);
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
      err.message === REPOSITORY_CHANGED ||
      err.message === PLATFORM_RATE_LIMIT_EXCEEDED ||
      err.message === PLATFORM_FAILURE ||
      err.message === PLATFORM_INTEGRATION_UNAUTHORIZED
    ) {
      logger.debug('Passing error up');
      throw err;
    }
    logger.error({ err }, 'Failed to ensure PR: ' + prTitle);
  }
  return { prResult: PrResult.Error };
}

export async function checkAutoMerge(pr: Pr, config): Promise<boolean> {
  logger.trace({ config }, 'checkAutoMerge');
  const {
    branchName,
    automerge,
    automergeType,
    automergeComment,
    requiredStatusChecks,
  } = config;
  logger.debug(
    { automerge, automergeType, automergeComment },
    `Checking #${pr.number} for automerge`
  );
  if (automerge) {
    logger.debug('PR is configured for automerge');
    // Return if PR not ready for automerge
    if (pr.isConflicted) {
      logger.debug('PR is conflicted');
      logger.debug({ pr });
      return false;
    }
    if (requiredStatusChecks && pr.canMerge !== true) {
      logger.debug(
        { canMergeReason: pr.canMergeReason },
        'PR is not ready for merge'
      );
      return false;
    }
    const branchStatus = await platform.getBranchStatus(
      branchName,
      requiredStatusChecks
    );
    if (branchStatus !== BranchStatus.green) {
      logger.debug(
        `PR is not ready for merge (branch status is ${branchStatus})`
      );
      return false;
    }
    // Check if it's been touched
    if (pr.isModified) {
      logger.debug('PR is ready for automerge but has been modified');
      return false;
    }
    if (automergeType === 'pr-comment') {
      logger.debug(`Applying automerge comment: ${automergeComment}`);
      // istanbul ignore if
      if (config.dryRun) {
        logger.info(
          'DRY-RUN: Would add PR automerge comment to PR #' + pr.number
        );
        return false;
      }
      return platform.ensureComment({
        number: pr.number,
        topic: null,
        content: automergeComment,
      });
    }
    // Let's merge this
    logger.debug(`Automerging #${pr.number}`);
    // istanbul ignore if
    if (config.dryRun) {
      logger.info('DRY-RUN: Would merge PR #' + pr.number);
      return false;
    }
    const res = await platform.mergePr(pr.number, branchName);
    if (res) {
      logger.info({ pr: pr.number, prTitle: pr.title }, 'PR automerged');
    }
    return res;
  }
  logger.debug('No automerge');
  return false;
}
