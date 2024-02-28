import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import {
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../../../constants/error-messages';
import { pkg } from '../../../../expose.cjs';
import { logger } from '../../../../logger';
import {
  PlatformPrOptions,
  Pr,
  PrDebugData,
  UpdatePrConfig,
  platform,
} from '../../../../modules/platform';
import { ensureComment } from '../../../../modules/platform/comment';
import {
  getPrBodyStruct,
  hashBody,
} from '../../../../modules/platform/pr-body';
import { scm } from '../../../../modules/platform/scm';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { getElapsedHours } from '../../../../util/date';
import { stripEmojis } from '../../../../util/emoji';
import { fingerprint } from '../../../../util/fingerprint';
import { getBranchLastCommitTime } from '../../../../util/git';
import { memoize } from '../../../../util/memoize';
import { incLimitedValue, isLimitReached } from '../../../global/limits';
import type {
  BranchConfig,
  BranchUpgradeConfig,
  PrBlockedBy,
} from '../../../types';
import { embedChangelogs } from '../../changelog';
import { resolveBranchStatus } from '../branch/status-checks';
import { getPrBody } from './body';
import { getChangedLabels, prepareLabels, shouldUpdateLabels } from './labels';
import { addParticipants } from './participants';
import { getPrCache, setPrCache } from './pr-cache';
import {
  generatePrBodyFingerprintConfig,
  validatePrCache,
} from './pr-fingerprint';

export function getPlatformPrOptions(
  config: RenovateConfig & PlatformPrOptions,
): PlatformPrOptions {
  const usePlatformAutomerge = Boolean(
    config.automerge &&
      (config.automergeType === 'pr' || config.automergeType === 'branch') &&
      config.platformAutomerge,
  );

  return {
    autoApprove: !!config.autoApprove,
    automergeStrategy: config.automergeStrategy,
    azureWorkItemId: config.azureWorkItemId ?? 0,
    bbUseDefaultReviewers: !!config.bbUseDefaultReviewers,
    gitLabIgnoreApprovals: !!config.gitLabIgnoreApprovals,
    forkModeDisallowMaintainerEdits: !!config.forkModeDisallowMaintainerEdits,
    usePlatformAutomerge,
  };
}

export interface ResultWithPr {
  type: 'with-pr';
  pr: Pr;
}

export interface ResultWithoutPr {
  type: 'without-pr';
  prBlockedBy: PrBlockedBy;
}

export type EnsurePrResult = ResultWithPr | ResultWithoutPr;

export function updatePrDebugData(
  targetBranch: string,
  labels: string[],
  debugData: PrDebugData | undefined,
): PrDebugData {
  const createdByRenovateVersion = debugData?.createdInVer ?? pkg.version;
  const updatedByRenovateVersion = pkg.version;

  const updatedPrDebugData: PrDebugData = {
    createdInVer: createdByRenovateVersion,
    updatedInVer: updatedByRenovateVersion,
    targetBranch,
  };

  // Add labels to the debug data object.
  // When to add:
  // 1. Add it when a new PR is created, i.e., when debugData is undefined.
  // 2. Add it if an existing PR already has labels in the debug data, confirming that we can update its labels.
  if (!debugData || is.array(debugData.labels)) {
    updatedPrDebugData.labels = labels;
  }

  return updatedPrDebugData;
}

function hasNotIgnoredReviewers(pr: Pr, config: BranchConfig): boolean {
  if (
    is.nonEmptyArray(config.ignoreReviewers) &&
    is.nonEmptyArray(pr.reviewers)
  ) {
    const ignoreReviewers = new Set(config.ignoreReviewers);
    return (
      pr.reviewers.filter((reviewer) => !ignoreReviewers.has(reviewer)).length >
      0
    );
  }
  return is.nonEmptyArray(pr.reviewers);
}

// Ensures that PR exists with matching title/body
export async function ensurePr(
  prConfig: BranchConfig,
): Promise<EnsurePrResult> {
  const config: BranchConfig = { ...prConfig };
  const filteredPrConfig = generatePrBodyFingerprintConfig(config);
  const prBodyFingerprint = fingerprint(filteredPrConfig);
  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const {
    branchName,
    ignoreTests,
    internalChecksAsSuccess,
    prTitle = '',
    upgrades,
  } = config;
  const getBranchStatus = memoize(() =>
    resolveBranchStatus(branchName, !!internalChecksAsSuccess, ignoreTests),
  );
  const dependencyDashboardCheck =
    config.dependencyDashboardChecks?.[config.branchName];
  // Check if PR already exists
  const existingPr = await platform.getBranchPr(branchName, config.baseBranch);
  const prCache = getPrCache(branchName);
  if (existingPr) {
    logger.debug('Found existing PR');
    if (existingPr.bodyStruct?.rebaseRequested) {
      logger.debug('PR rebase requested, so skipping cache check');
    } else if (prCache) {
      logger.trace({ prCache }, 'Found existing PR cache');
      // return if pr cache is valid and pr was not changed in the past 24hrs
      if (validatePrCache(prCache, prBodyFingerprint)) {
        return { type: 'with-pr', pr: existingPr };
      }
    } else if (config.repositoryCache === 'enabled') {
      logger.debug('PR cache not found');
    }
  }
  config.upgrades = [];

  if (config.artifactErrors?.length) {
    logger.debug('Forcing PR because of artifact errors');
    config.forcePr = true;
  }

  if (dependencyDashboardCheck === 'approvePr') {
    logger.debug('Forcing PR because of dependency dashboard approval');
    config.forcePr = true;
  }

  if (!existingPr) {
    // Only create a PR if a branch automerge has failed
    if (
      config.automerge === true &&
      config.automergeType?.startsWith('branch') &&
      !config.forcePr
    ) {
      logger.debug(`Branch automerge is enabled`);
      if (
        config.stabilityStatus !== 'yellow' &&
        (await getBranchStatus()) === 'yellow' &&
        is.number(config.prNotPendingHours)
      ) {
        logger.debug('Checking how long this branch has been pending');
        const lastCommitTime = await getBranchLastCommitTime(branchName);
        if (getElapsedHours(lastCommitTime) >= config.prNotPendingHours) {
          logger.debug(
            'Branch exceeds prNotPending hours - forcing PR creation',
          );
          config.forcePr = true;
        }
      }
      if (config.forcePr || (await getBranchStatus()) === 'red') {
        logger.debug(`Branch tests failed, so will create PR`);
      } else {
        // Branch should be automerged, so we don't want to create a PR
        return { type: 'without-pr', prBlockedBy: 'BranchAutomerge' };
      }
    }
    if (config.prCreation === 'status-success') {
      logger.debug('Checking branch combined status');
      if ((await getBranchStatus()) !== 'green') {
        logger.debug(`Branch status isn't green - not creating PR`);
        return { type: 'without-pr', prBlockedBy: 'AwaitingTests' };
      }
      logger.debug('Branch status success');
    } else if (
      config.prCreation === 'approval' &&
      dependencyDashboardCheck !== 'approvePr'
    ) {
      return { type: 'without-pr', prBlockedBy: 'NeedsApproval' };
    } else if (config.prCreation === 'not-pending' && !config.forcePr) {
      logger.debug('Checking branch combined status');
      if ((await getBranchStatus()) === 'yellow') {
        logger.debug(`Branch status is yellow - checking timeout`);
        const lastCommitTime = await getBranchLastCommitTime(branchName);
        const elapsedHours = getElapsedHours(lastCommitTime);
        if (
          !dependencyDashboardCheck &&
          ((config.stabilityStatus && config.stabilityStatus !== 'yellow') ||
            (is.number(config.prNotPendingHours) &&
              elapsedHours < config.prNotPendingHours))
        ) {
          logger.debug(
            `Branch is ${elapsedHours} hours old - skipping PR creation`,
          );
          return {
            type: 'without-pr',
            prBlockedBy: 'AwaitingTests',
          };
        }
        const prNotPendingHours = String(config.prNotPendingHours);
        logger.debug(
          `prNotPendingHours=${prNotPendingHours} threshold hit - creating PR`,
        );
      }
      logger.debug('Branch status success');
    }
  }

  const processedUpgrades: string[] = [];
  const commitRepos: string[] = [];

  function getRepoNameWithSourceDirectory(
    upgrade: BranchUpgradeConfig,
  ): string {
    // TODO: types (#22198)
    return `${upgrade.repoName!}${
      upgrade.sourceDirectory ? `:${upgrade.sourceDirectory}` : ''
    }`;
  }

  if (config.fetchChangeLogs === 'pr') {
    // fetch changelogs when not already done;
    await embedChangelogs(upgrades);
  }

  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    // TODO: types (#22198)
    const upgradeKey = `${upgrade.depType!}-${upgrade.depName!}-${upgrade.manager}-${upgrade.currentVersion ?? ''}-${upgrade.currentValue ?? ''}-${upgrade.newVersion ?? ''}-${upgrade.newValue ?? ''}`;
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
            for (const version of logJSON.versions) {
              const release = { ...version };
              upgrade.releases.push(release);
            }
          }
        }
      } else if (logJSON.error === 'MissingGithubToken') {
        upgrade.prBodyNotes ??= [];
        upgrade.prBodyNotes = [
          ...upgrade.prBodyNotes,
          [
            '> :exclamation: **Important**',
            '> ',
            '> Release Notes retrieval for this PR were skipped because no github.com credentials were available. ',
            '> If you are self-hosted, please see [this instruction](https://github.com/renovatebot/renovate/blob/master/docs/usage/examples/self-hosting.md#githubcom-token-for-release-notes).',
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
      // TODO: types (#22198)
      notesSourceUrl = `${upgrade.sourceUrl!}${
        upgrade.sourceDirectory ? `:${upgrade.sourceDirectory}` : ''
      }`;
    }

    if (upgrade.hasReleaseNotes && notesSourceUrl) {
      if (releaseNotesSources.includes(notesSourceUrl)) {
        logger.debug(
          { depName: upgrade.depName },
          'Removing duplicate release notes',
        );
        upgrade.hasReleaseNotes = false;
      } else {
        releaseNotesSources.push(notesSourceUrl);
      }
    }
  }

  const prBody = getPrBody(
    config,
    {
      debugData: updatePrDebugData(
        config.baseBranch,
        prepareLabels(config), // include labels in debug data
        existingPr?.bodyStruct?.debugData,
      ),
    },
    config,
  );

  try {
    if (existingPr) {
      logger.debug('Processing existing PR');

      if (
        !existingPr.hasAssignees &&
        !hasNotIgnoredReviewers(existingPr, config) &&
        config.automerge &&
        !config.assignAutomerge &&
        (await getBranchStatus()) === 'red'
      ) {
        logger.debug(`Setting assignees and reviewers as status checks failed`);
        await addParticipants(config, existingPr);
      }
      // Check if existing PR needs updating
      const existingPrTitle = stripEmojis(existingPr.title);
      const existingPrBodyHash = existingPr.bodyStruct?.hash;
      const newPrTitle = stripEmojis(prTitle);
      const newPrBodyHash = hashBody(prBody);

      const prInitialLabels = existingPr.bodyStruct?.debugData?.labels;
      const prCurrentLabels = existingPr.labels;
      const configuredLabels = prepareLabels(config);

      const labelsNeedUpdate = shouldUpdateLabels(
        prInitialLabels,
        prCurrentLabels,
        configuredLabels,
      );

      if (
        existingPr?.targetBranch === config.baseBranch &&
        existingPrTitle === newPrTitle &&
        existingPrBodyHash === newPrBodyHash &&
        !labelsNeedUpdate
      ) {
        // adds or-cache for existing PRs
        setPrCache(branchName, prBodyFingerprint, false);
        logger.debug(
          `Pull Request #${existingPr.number} does not need updating`,
        );
        return { type: 'with-pr', pr: existingPr };
      }

      const updatePrConfig: UpdatePrConfig = {
        number: existingPr.number,
        prTitle,
        prBody,
        platformOptions: getPlatformPrOptions(config),
      };
      // PR must need updating
      if (existingPr?.targetBranch !== config.baseBranch) {
        logger.debug(
          {
            branchName,
            oldBaseBranch: existingPr?.targetBranch,
            newBaseBranch: config.baseBranch,
          },
          'PR base branch has changed',
        );
        updatePrConfig.targetBranch = config.baseBranch;
      }

      if (labelsNeedUpdate) {
        logger.debug(
          {
            branchName,
            prCurrentLabels,
            configuredLabels,
          },
          'PR labels have changed',
        );

        // Divide labels into three categories:
        // i) addLabels: Labels that need to be added
        // ii) removeLabels: Labels that need to be removed
        // iii) labels: New labels for the PR, replacing the old labels array entirely.
        // This distinction is necessary because different platforms update labels differently
        // For more details, refer to the updatePr function of each platform.

        const [addLabels, removeLabels] = getChangedLabels(
          prCurrentLabels,
          configuredLabels,
        );

        // for Gitea
        updatePrConfig.labels = configuredLabels;

        // for GitHub, GitLab
        updatePrConfig.addLabels = addLabels;
        updatePrConfig.removeLabels = removeLabels;
      }
      if (existingPrTitle !== newPrTitle) {
        logger.debug(
          {
            branchName,
            oldPrTitle: existingPr.title,
            newPrTitle: prTitle,
          },
          'PR title changed',
        );
      } else if (!config.committedFiles && !config.rebaseRequested) {
        logger.debug(
          {
            prTitle,
          },
          'PR body changed',
        );
      }

      if (GlobalConfig.get('dryRun')) {
        logger.info(`DRY-RUN: Would update PR #${existingPr.number}`);
        return { type: 'with-pr', pr: existingPr };
      } else {
        await platform.updatePr(updatePrConfig);
        logger.info({ pr: existingPr.number, prTitle }, `PR updated`);
        setPrCache(branchName, prBodyFingerprint, true);
      }
      return {
        type: 'with-pr',
        pr: {
          ...existingPr,
          bodyStruct: getPrBodyStruct(prBody),
          title: prTitle,
          targetBranch: config.baseBranch,
        },
      };
    }
    logger.debug({ branch: branchName, prTitle }, `Creating PR`);
    if (config.updateType === 'rollback') {
      logger.info('Creating Rollback PR');
    }
    let pr: Pr | null;
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would create PR: ' + prTitle);
      pr = { number: 0 } as never;
    } else {
      try {
        if (
          !dependencyDashboardCheck &&
          isLimitReached('PullRequests') &&
          !config.isVulnerabilityAlert
        ) {
          logger.debug('Skipping PR - limit reached');
          return { type: 'without-pr', prBlockedBy: 'RateLimited' };
        }
        pr = await platform.createPr({
          sourceBranch: branchName,
          targetBranch: config.baseBranch,
          prTitle,
          prBody,
          labels: prepareLabels(config),
          platformOptions: getPlatformPrOptions(config),
          draftPR: !!config.draftPR,
          milestone: config.milestone,
        });

        incLimitedValue('PullRequests');
        logger.info({ pr: pr?.number, prTitle }, 'PR created');
      } catch (err) {
        logger.debug({ err }, 'Pull request creation error');
        if (
          err.body?.message === 'Validation failed' &&
          err.body.errors?.length &&
          err.body.errors.some((error: { message?: string }) =>
            error.message?.startsWith('A pull request already exists'),
          )
        ) {
          logger.warn('A pull requests already exists');
          return { type: 'without-pr', prBlockedBy: 'Error' };
        }
        if (err.statusCode === 502) {
          logger.warn(
            { branch: branchName },
            'Deleting branch due to server error',
          );
          await scm.deleteBranch(branchName);
        }
        return { type: 'without-pr', prBlockedBy: 'Error' };
      }
    }
    if (
      pr &&
      config.branchAutomergeFailureMessage &&
      !config.suppressNotifications?.includes('branchAutomergeFailure')
    ) {
      const topic = 'Branch automerge failure';
      let content =
        'This PR was configured for branch automerge. However, this is not possible, so it has been raised as a PR instead.';
      if (config.branchAutomergeFailureMessage === 'branch status error') {
        content += '\n___\n * Branch has one or more failed status checks';
      }
      content = platform.massageMarkdown(content);
      logger.debug('Adding branch automerge failure message to PR');
      if (GlobalConfig.get('dryRun')) {
        logger.info(`DRY-RUN: Would add comment to PR #${pr.number}`);
      } else {
        await ensureComment({
          number: pr.number,
          topic,
          content,
        });
      }
    }
    // Skip assign and review if automerging PR
    if (pr) {
      if (
        config.automerge &&
        !config.assignAutomerge &&
        (await getBranchStatus()) !== 'red'
      ) {
        logger.debug(
          `Skipping assignees and reviewers as automerge=${config.automerge}`,
        );
      } else {
        await addParticipants(config, pr);
      }
      setPrCache(branchName, prBodyFingerprint, true);
      logger.debug(`Created Pull Request #${pr.number}`);
      return { type: 'with-pr', pr };
    }
  } catch (err) {
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
    return { type: 'with-pr', pr: existingPr };
  }
  return { type: 'without-pr', prBlockedBy: 'Error' };
}
