// TODO #7154
import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import {
  CONFIG_VALIDATION,
  MANAGER_LOCKFILE_ERROR,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
  WORKER_FILE_UPDATE_FAILED,
} from '../../../../constants/error-messages';
import { logger, removeMeta } from '../../../../logger';
import { getAdditionalFiles } from '../../../../modules/manager/npm/post-update';
import { Pr, platform } from '../../../../modules/platform';
import {
  ensureComment,
  ensureCommentRemoval,
} from '../../../../modules/platform/comment';
import { hashBody } from '../../../../modules/platform/pr-body';
import { BranchStatus, PrState } from '../../../../types';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { getElapsedDays } from '../../../../util/date';
import { emojify } from '../../../../util/emoji';
import {
  checkoutBranch,
  deleteBranch,
  getBranchCommit,
  branchExists as gitBranchExists,
  isBranchConflicted,
  isBranchModified,
} from '../../../../util/git';
import { setCachedConflictResult } from '../../../../util/git/conflicts-cache';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '../../../../util/merge-confidence';
import * as template from '../../../../util/template';
import { Limit, isLimitReached } from '../../../global/limits';
import { BranchConfig, BranchResult, PrBlockedBy } from '../../../types';
import { embedChangelog, needsChangelogs } from '../../changelog';
import { ensurePr, getPlatformPrOptions, updatePrDebugData } from '../pr';
import { checkAutoMerge } from '../pr/automerge';
import { getPrBody } from '../pr/body';
import { setArtifactErrorStatus } from './artifacts';
import { tryBranchAutomerge } from './automerge';
import { prAlreadyExisted } from './check-existing';
import { commitFilesToBranch } from './commit';
import executePostUpgradeCommands from './execute-post-upgrade-commands';
import { getUpdatedPackageFiles } from './get-updated';
import { handlepr } from './handle-existing';
import { shouldReuseExistingBranch } from './reuse';
import { isScheduledNow } from './schedule';
import { setConfidence, setStability } from './status-checks';

function rebaseCheck(config: RenovateConfig, branchPr: Pr): boolean {
  const titleRebase = branchPr.title?.startsWith('rebase!');
  const labelRebase = !!branchPr.labels?.includes(config.rebaseLabel!);
  const prRebaseChecked = !!branchPr.bodyStruct?.rebaseRequested;

  return titleRebase || labelRebase || prRebaseChecked;
}

async function deleteBranchSilently(branchName: string): Promise<void> {
  try {
    await deleteBranch(branchName);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ branchName, err }, 'Branch auto-remove failed');
  }
}

export interface ProcessBranchResult {
  branchExists: boolean;
  prBlockedBy?: PrBlockedBy;
  prNo?: number;
  result: BranchResult;
  commitSha?: string | null;
}

export async function processBranch(
  branchConfig: BranchConfig
): Promise<ProcessBranchResult> {
  let commitSha: string | null = null;
  let config: BranchConfig = { ...branchConfig };
  logger.trace({ config }, 'processBranch()');
  let branchExists = gitBranchExists(config.branchName);
  if (!branchExists && config.branchPrefix !== config.branchPrefixOld) {
    const branchName = config.branchName.replace(
      config.branchPrefix!,
      config.branchPrefixOld!
    );
    branchExists = gitBranchExists(branchName);
    if (branchExists) {
      config.branchName = branchName;
      logger.debug('Found existing branch with branchPrefixOld');
    }
  }

  let branchPr = await platform.getBranchPr(config.branchName);
  logger.debug(`branchExists=${branchExists}`);
  const dependencyDashboardCheck =
    config.dependencyDashboardChecks?.[config.branchName];
  logger.debug(`dependencyDashboardCheck=${dependencyDashboardCheck!}`);
  if (branchPr) {
    config.rebaseRequested = rebaseCheck(config, branchPr);
    logger.debug(`PR rebase requested=${config.rebaseRequested}`);
  }
  const artifactErrorTopic = emojify(':warning: Artifact update problem');
  try {
    // Check if branch already existed
    const existingPr = branchPr ? undefined : await prAlreadyExisted(config);
    if (existingPr && !dependencyDashboardCheck) {
      logger.debug(
        { prTitle: config.prTitle },
        'Closed PR already exists. Skipping branch.'
      );
      await handlepr(config, existingPr);
      return {
        branchExists: false,
        prNo: existingPr.number,
        result: BranchResult.AlreadyExisted,
      };
    }
    // istanbul ignore if
    if (!branchExists && config.dependencyDashboardApproval) {
      if (dependencyDashboardCheck) {
        logger.debug(`Branch ${config.branchName} is approved for creation`);
      } else {
        logger.debug(`Branch ${config.branchName} needs approval`);
        return {
          branchExists,
          prNo: branchPr?.number,
          result: BranchResult.NeedsApproval,
        };
      }
    }
    if (
      !branchExists &&
      isLimitReached(Limit.Branches) &&
      !dependencyDashboardCheck &&
      !config.isVulnerabilityAlert
    ) {
      logger.debug('Reached branch limit - skipping branch creation');
      return {
        branchExists,
        prNo: branchPr?.number,
        result: BranchResult.BranchLimitReached,
      };
    }
    if (
      isLimitReached(Limit.Commits) &&
      !dependencyDashboardCheck &&
      !config.isVulnerabilityAlert
    ) {
      logger.debug('Reached commits limit - skipping branch');
      return {
        branchExists,
        prNo: branchPr?.number,
        result: BranchResult.CommitLimitReached,
      };
    }
    if (
      !branchExists &&
      branchConfig.pendingChecks &&
      !dependencyDashboardCheck
    ) {
      return {
        branchExists: false,
        prNo: branchPr?.number,
        result: BranchResult.Pending,
      };
    }
    if (branchExists) {
      logger.debug('Checking if PR has been edited');
      const branchIsModified = await isBranchModified(config.branchName);
      if (branchPr) {
        logger.debug('Found existing branch PR');
        if (branchPr.state !== PrState.Open) {
          logger.debug(
            'PR has been closed or merged since this run started - aborting'
          );
          throw new Error(REPOSITORY_CHANGED);
        }
        if (
          branchIsModified ||
          (branchPr.targetBranch &&
            branchPr.targetBranch !== branchConfig.baseBranch)
        ) {
          logger.debug({ prNo: branchPr.number }, 'PR has been edited');
          if (dependencyDashboardCheck || config.rebaseRequested) {
            logger.debug('Manual rebase has been requested for PR');
          } else {
            const newBody = await getPrBody(branchConfig, {
              debugData: updatePrDebugData(existingPr?.bodyStruct?.debugData),
              rebasingNotice:
                'Renovate will not automatically rebase this PR, because other commits have been found.',
            });
            const newBodyHash = hashBody(newBody);
            if (newBodyHash !== branchPr.bodyStruct?.hash) {
              if (GlobalConfig.get('dryRun')) {
                logger.info(
                  `DRY-RUN: Would update existing PR to indicate that rebasing is not possible`
                );
              } else {
                logger.debug(
                  'Updating existing PR to indicate that rebasing is not possible'
                );
                await platform.updatePr({
                  number: branchPr.number,
                  prTitle: branchPr.title,
                  prBody: newBody,
                  platformOptions: getPlatformPrOptions(config),
                });
              }
            }
            return {
              branchExists,
              prNo: branchPr.number,
              result: BranchResult.PrEdited,
            };
          }
        }
      } else if (branchIsModified) {
        const oldPr = await platform.findPr({
          branchName: config.branchName,
          state: PrState.NotOpen,
        });
        if (!oldPr) {
          logger.debug('Branch has been edited but found no PR - skipping');
          return {
            branchExists,
            result: BranchResult.PrEdited,
          };
        }
        const branchSha = getBranchCommit(config.branchName);
        const oldPrSha = oldPr?.sha;
        if (!oldPrSha || oldPrSha === branchSha) {
          logger.debug(
            { oldPrNumber: oldPr.number, oldPrSha, branchSha },
            'Found old PR matching this branch - will override it'
          );
        } else {
          logger.debug(
            { oldPrNumber: oldPr.number, oldPrSha, branchSha },
            'Found old PR but the SHA is different'
          );
          return {
            branchExists,
            result: BranchResult.PrEdited,
          };
        }
      }
    }

    // Check schedule
    config.isScheduledNow = isScheduledNow(config, 'schedule');
    if (!config.isScheduledNow && !dependencyDashboardCheck) {
      if (!branchExists) {
        logger.debug('Skipping branch creation as not within schedule');
        return {
          branchExists,
          prNo: branchPr?.number,
          result: BranchResult.NotScheduled,
        };
      }
      if (config.updateNotScheduled === false && !config.rebaseRequested) {
        logger.debug('Skipping branch update as not within schedule');
        return {
          branchExists,
          prNo: branchPr?.number,
          result: BranchResult.UpdateNotScheduled,
        };
      }
      // istanbul ignore if
      if (!branchPr) {
        logger.debug('Skipping PR creation out of schedule');
        return {
          branchExists,
          result: BranchResult.NotScheduled,
        };
      }
      logger.debug(
        'Branch + PR exists but is not scheduled -- will update if necessary'
      );
    }
    //stability checks
    if (
      config.upgrades.some(
        (upgrade) =>
          (upgrade.stabilityDays && upgrade.releaseTimestamp) ||
          isActiveConfidenceLevel(upgrade.minimumConfidence!)
      )
    ) {
      // Only set a stability status check if one or more of the updates contain
      // both a stabilityDays setting and a releaseTimestamp
      config.stabilityStatus = BranchStatus.green;
      // Default to 'success' but set 'pending' if any update is pending
      for (const upgrade of config.upgrades) {
        if (is.number(upgrade.stabilityDays) && upgrade.releaseTimestamp) {
          const daysElapsed = getElapsedDays(upgrade.releaseTimestamp);
          if (daysElapsed < upgrade.stabilityDays) {
            logger.debug(
              {
                depName: upgrade.depName,
                daysElapsed,
                stabilityDays: upgrade.stabilityDays,
              },
              'Update has not passed stability days'
            );
            config.stabilityStatus = BranchStatus.yellow;
            continue;
          }
        }
        const datasource = upgrade.datasource!;
        const depName = upgrade.depName!;
        const minimumConfidence = upgrade.minimumConfidence!;
        const updateType = upgrade.updateType!;
        const currentVersion = upgrade.currentVersion!;
        const newVersion = upgrade.newVersion!;
        if (isActiveConfidenceLevel(minimumConfidence)) {
          const confidence = await getMergeConfidenceLevel(
            datasource,
            depName,
            currentVersion,
            newVersion,
            updateType
          );
          if (satisfiesConfidenceLevel(confidence, minimumConfidence)) {
            config.confidenceStatus = BranchStatus.green;
          } else {
            logger.debug(
              { depName, confidence, minimumConfidence },
              'Update does not meet minimum confidence scores'
            );
            config.confidenceStatus = BranchStatus.yellow;
            continue;
          }
        }
      }
      // Don't create a branch if we know it will be status ProcessBranchResult.Pending
      if (
        !dependencyDashboardCheck &&
        !branchExists &&
        config.stabilityStatus === BranchStatus.yellow &&
        ['not-pending', 'status-success'].includes(config.prCreation!)
      ) {
        logger.debug(
          'Skipping branch creation due to internal status checks not met'
        );
        return {
          branchExists,
          prNo: branchPr?.number,
          result: BranchResult.Pending,
        };
      }
    }

    const userRebaseRequested =
      dependencyDashboardCheck === 'rebase' ||
      !!config.dependencyDashboardRebaseAllOpen ||
      !!config.rebaseRequested;
    const userApproveAllPendingPR = !!config.dependencyDashboardAllPending;
    const userOpenAllRateLimtedPR = !!config.dependencyDashboardAllRateLimited;
    if (userRebaseRequested) {
      logger.debug('Manual rebase requested via Dependency Dashboard');
      config.reuseExistingBranch = false;
    } else if (userApproveAllPendingPR) {
      logger.debug(
        'A user manually approved all pending PRs via the Dependency Dashboard.'
      );
    } else if (userOpenAllRateLimtedPR) {
      logger.debug(
        'A user manually approved all rate-limited PRs via the Dependency Dashboard.'
      );
    } else if (branchExists && config.rebaseWhen === 'never') {
      logger.debug('rebaseWhen=never so skipping branch update check');
      return {
        branchExists,
        prNo: branchPr?.number,
        result: BranchResult.NoWork,
      };
    } else {
      config = { ...config, ...(await shouldReuseExistingBranch(config)) };
    }
    // TODO: types (#7154)
    logger.debug(`Using reuseExistingBranch: ${config.reuseExistingBranch!}`);
    if (!(config.reuseExistingBranch && config.skipBranchUpdate)) {
      await checkoutBranch(config.baseBranch!);
      const res = await getUpdatedPackageFiles(config);
      // istanbul ignore if
      if (res.artifactErrors && config.artifactErrors) {
        res.artifactErrors = config.artifactErrors.concat(res.artifactErrors);
      }
      config = { ...config, ...res };
      if (config.updatedPackageFiles?.length) {
        logger.debug(
          `Updated ${config.updatedPackageFiles.length} package files`
        );
      } else {
        logger.debug('No package files need updating');
      }
      const additionalFiles = await getAdditionalFiles(
        config,
        branchConfig.packageFiles!
      );
      config.artifactErrors = (config.artifactErrors ?? []).concat(
        additionalFiles.artifactErrors
      );
      config.updatedArtifacts = (config.updatedArtifacts ?? []).concat(
        additionalFiles.updatedArtifacts
      );
      if (config.updatedArtifacts?.length) {
        logger.debug(
          {
            updatedArtifacts: config.updatedArtifacts.map((f) =>
              f.type === 'deletion' ? `${f.path} (delete)` : f.path
            ),
          },
          `Updated ${config.updatedArtifacts.length} lock files`
        );
      } else {
        logger.debug('No updated lock files in branch');
      }
      const postUpgradeCommandResults = await executePostUpgradeCommands(
        config
      );

      if (postUpgradeCommandResults !== null) {
        const { updatedArtifacts, artifactErrors } = postUpgradeCommandResults;
        config.updatedArtifacts = updatedArtifacts;
        config.artifactErrors = artifactErrors;
      }

      removeMeta(['dep']);

      if (config.artifactErrors?.length) {
        if (config.releaseTimestamp) {
          logger.debug(`Branch timestamp: ` + config.releaseTimestamp);
          const releaseTimestamp = DateTime.fromISO(config.releaseTimestamp);
          if (releaseTimestamp.plus({ hours: 2 }) < DateTime.local()) {
            logger.debug(
              'PR is older than 2 hours, raise PR with lock file errors'
            );
          } else if (branchExists) {
            logger.debug(
              'PR is less than 2 hours old but branchExists so updating anyway'
            );
          } else {
            logger.debug(
              'PR is less than 2 hours old - raise error instead of PR'
            );
            throw new Error(MANAGER_LOCKFILE_ERROR);
          }
        } else {
          logger.debug('PR has no releaseTimestamp');
        }
      } else if (config.updatedArtifacts?.length && branchPr) {
        // If there are artifacts, no errors, and an existing PR then ensure any artifacts error comment is removed
        // istanbul ignore if
        if (GlobalConfig.get('dryRun')) {
          logger.info(
            `DRY-RUN: Would ensure comment removal in PR #${branchPr.number}`
          );
        } else {
          // Remove artifacts error comment only if this run has successfully updated artifacts
          await ensureCommentRemoval({
            type: 'by-topic',
            number: branchPr.number,
            topic: artifactErrorTopic,
          });
        }
      }
      const forcedManually = userRebaseRequested || !branchExists;

      config.isConflicted ??=
        branchExists &&
        (await isBranchConflicted(config.baseBranch!, config.branchName));
      config.forceCommit = forcedManually || config.isConflicted;

      config.stopUpdating = branchPr?.labels?.includes(
        config.stopUpdatingLabel!
      );

      const prRebaseChecked = !!branchPr?.bodyStruct?.rebaseRequested;

      if (branchExists && !dependencyDashboardCheck && config.stopUpdating) {
        if (!prRebaseChecked) {
          logger.info(
            'Branch updating is skipped because stopUpdatingLabel is present in config'
          );
          return {
            branchExists: true,
            prNo: branchPr?.number,
            result: BranchResult.NoWork,
          };
        }
      }

      // compile commit message with body, which maybe needs changelogs
      if (config.commitBody) {
        if (
          config.fetchReleaseNotes &&
          needsChangelogs(config, ['commitBody'])
        ) {
          // we only need first upgrade, the others are only needed on PR update
          // we add it to first, so PR fetch can skip fetching for that update
          await embedChangelog(config.upgrades[0]);
        }
        // changelog is on first upgrade
        config.commitMessage = `${config.commitMessage!}\n\n${template.compile(
          config.commitBody,
          {
            ...config,
            logJSON: config.upgrades[0].logJSON,
            releases: config.upgrades[0].releases,
          }
        )}`;

        logger.trace(`commitMessage: ` + JSON.stringify(config.commitMessage));
      }

      commitSha = await commitFilesToBranch(config);
    }
    // istanbul ignore if
    if (branchPr && platform.refreshPr) {
      await platform.refreshPr(branchPr.number);
    }
    if (!commitSha && !branchExists) {
      return {
        branchExists,
        prNo: branchPr?.number,
        result: BranchResult.NoWork,
      };
    }
    if (commitSha) {
      const action = branchExists ? 'updated' : 'created';
      logger.info({ commitSha }, `Branch ${action}`);
      // TODO #7154
      setCachedConflictResult(
        config.baseBranch!,
        getBranchCommit(config.baseBranch!)!,
        config.branchName,
        commitSha,
        false
      );
    }
    // Set branch statuses
    await setArtifactErrorStatus(config);
    await setStability(config);
    await setConfidence(config);

    // break if we pushed a new commit because status check are pretty sure pending but maybe not reported yet
    // but do not break when there are artifact errors
    if (
      !config.artifactErrors?.length &&
      !userRebaseRequested &&
      commitSha &&
      config.prCreation !== 'immediate'
    ) {
      logger.debug({ commitSha }, `Branch status pending`);
      return {
        branchExists: true,
        prNo: branchPr?.number,
        result: BranchResult.Pending,
        commitSha,
      };
    }

    // Try to automerge branch and finish if successful, but only if branch already existed before this run
    if (branchExists || config.ignoreTests) {
      const mergeStatus = await tryBranchAutomerge(config);
      logger.debug(`mergeStatus=${mergeStatus}`);
      if (mergeStatus === 'automerged') {
        if (GlobalConfig.get('dryRun')) {
          logger.info('DRY-RUN: Would delete branch' + config.branchName);
        } else {
          await deleteBranchSilently(config.branchName);
        }
        logger.debug('Branch is automerged - returning');
        return { branchExists: false, result: BranchResult.Automerged };
      }
      if (mergeStatus === 'off schedule') {
        logger.debug(
          'Branch cannot automerge now because automergeSchedule is off schedule - skipping'
        );
        return {
          branchExists,
          result: BranchResult.NotScheduled,
          commitSha,
        };
      }
      if (
        mergeStatus === 'stale' &&
        ['conflicted', 'never'].includes(config.rebaseWhen!)
      ) {
        logger.warn(
          'Branch cannot automerge because it is behind base branch and rebaseWhen setting disallows rebasing - raising a PR instead'
        );
        config.forcePr = true;
        config.branchAutomergeFailureMessage = mergeStatus;
      }
      if (
        mergeStatus === 'automerge aborted - PR exists' ||
        mergeStatus === 'branch status error' ||
        mergeStatus === 'failed'
      ) {
        logger.debug({ mergeStatus }, 'Branch automerge not possible');
        config.forcePr = true;
        config.branchAutomergeFailureMessage = mergeStatus;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug({ err }, 'Received a 404 error - aborting run');
      throw new Error(REPOSITORY_CHANGED);
    }
    if (err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
      logger.debug('Passing rate-limit-exceeded error up');
      throw err;
    }
    if (err.message === REPOSITORY_CHANGED) {
      logger.debug('Passing repository-changed error up');
      throw err;
    }
    if (err.message?.startsWith('remote: Invalid username or password')) {
      logger.debug('Throwing bad credentials');
      throw new Error(PLATFORM_BAD_CREDENTIALS);
    }
    if (
      err.message?.startsWith(
        'ssh_exchange_identification: Connection closed by remote host'
      )
    ) {
      logger.debug('Throwing bad credentials');
      throw new Error(PLATFORM_BAD_CREDENTIALS);
    }
    if (err.message === PLATFORM_BAD_CREDENTIALS) {
      logger.debug('Passing bad-credentials error up');
      throw err;
    }
    if (err.message === PLATFORM_INTEGRATION_UNAUTHORIZED) {
      logger.debug('Passing integration-unauthorized error up');
      throw err;
    }
    if (err.message === MANAGER_LOCKFILE_ERROR) {
      logger.debug('Passing lockfile-error up');
      throw err;
    }
    if (err.message?.includes('space left on device')) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    }
    if (err.message === SYSTEM_INSUFFICIENT_DISK_SPACE) {
      logger.debug('Passing disk-space error up');
      throw err;
    }
    if (err.message.startsWith('Resource not accessible by integration')) {
      logger.debug('Passing 403 error up');
      throw err;
    }
    if (err.message === WORKER_FILE_UPDATE_FAILED) {
      logger.warn('Error updating branch: update failure');
    } else if (err.message.startsWith('bundler-')) {
      // we have already warned inside the bundler artifacts error handling, so just return
      return {
        branchExists: true,
        prNo: branchPr?.number,
        result: BranchResult.Error,
        commitSha,
      };
    } else if (
      err.messagee &&
      err.message.includes('fatal: Authentication failed')
    ) {
      throw new Error(PLATFORM_AUTHENTICATION_ERROR);
    } else if (err.message?.includes('fatal: bad revision')) {
      logger.debug({ err }, 'Aborting job due to bad revision error');
      throw new Error(REPOSITORY_CHANGED);
    } else if (err.message === CONFIG_VALIDATION) {
      logger.debug('Passing config validation error up');
      throw err;
    } else if (err.message === TEMPORARY_ERROR) {
      logger.debug('Passing TEMPORARY_ERROR error up');
      throw err;
    } else if (!(err instanceof ExternalHostError)) {
      logger.warn({ err }, `Error updating branch`);
    }
    // Don't throw here - we don't want to stop the other renovations
    return {
      branchExists,
      prNo: branchPr?.number,
      result: BranchResult.Error,
      commitSha,
    };
  }
  try {
    logger.debug('Ensuring PR');
    logger.debug(
      `There are ${config.errors!.length} errors and ${
        config.warnings!.length
      } warnings`
    );
    const ensurePrResult = await ensurePr(config);
    if (ensurePrResult.type === 'without-pr') {
      const { prBlockedBy } = ensurePrResult;
      branchPr = null;
      if (prBlockedBy === 'RateLimited' && !config.isVulnerabilityAlert) {
        logger.debug('Reached PR limit - skipping PR creation');
        return {
          branchExists,
          prBlockedBy,
          result: BranchResult.PrLimitReached,
          commitSha,
        };
      }
      // TODO: ensurePr should check for automerge itself (#9719)
      if (prBlockedBy === 'NeedsApproval') {
        return {
          branchExists,
          prBlockedBy,
          result: BranchResult.NeedsPrApproval,
          commitSha,
        };
      }
      if (prBlockedBy === 'AwaitingTests') {
        return {
          branchExists,
          prBlockedBy,
          result: BranchResult.Pending,
          commitSha,
        };
      }
      if (prBlockedBy === 'BranchAutomerge') {
        return {
          branchExists,
          prBlockedBy,
          result: BranchResult.Done,
          commitSha,
        };
      }
      if (prBlockedBy === 'Error') {
        return {
          branchExists,
          prBlockedBy,
          result: BranchResult.Error,
          commitSha,
        };
      }
      logger.warn({ prBlockedBy }, 'Unknown PrBlockedBy result');
      return {
        branchExists,
        prBlockedBy,
        result: BranchResult.Error,
        commitSha,
      };
    }
    if (ensurePrResult.type === 'with-pr') {
      const { pr } = ensurePrResult;
      branchPr = pr;
      if (config.artifactErrors?.length) {
        logger.warn(
          { artifactErrors: config.artifactErrors },
          'artifactErrors'
        );
        let content = `Renovate failed to update `;
        content +=
          config.artifactErrors.length > 1 ? 'artifacts' : 'an artifact';
        content +=
          ' related to this branch. You probably do not want to merge this PR as-is.';
        content += emojify(
          `\n\n:recycle: Renovate will retry this branch, including artifacts, only when one of the following happens:\n\n`
        );
        content +=
          ' - any of the package files in this branch needs updating, or \n';
        content += ' - the branch becomes conflicted, or\n';
        content +=
          ' - you click the rebase/retry checkbox if found above, or\n';
        content +=
          ' - you rename this PR\'s title to start with "rebase!" to trigger it manually';
        content += '\n\nThe artifact failure details are included below:\n\n';
        // TODO: types (#7154)
        config.artifactErrors.forEach((error) => {
          content += `##### File name: ${error.lockFile!}\n\n`;
          content += `\`\`\`\n${error.stderr!}\n\`\`\`\n\n`;
        });
        content = platform.massageMarkdown(content);
        if (
          !(
            config.suppressNotifications!.includes('artifactErrors') ||
            config.suppressNotifications!.includes('lockFileErrors')
          )
        ) {
          if (GlobalConfig.get('dryRun')) {
            logger.info(
              `DRY-RUN: Would ensure lock file error comment in PR #${pr.number}`
            );
          } else {
            await ensureComment({
              number: pr.number,
              topic: artifactErrorTopic,
              content,
            });
          }
        }
      } else if (config.automerge) {
        logger.debug('PR is configured for automerge');
        const prAutomergeResult = await checkAutoMerge(pr, config);
        if (prAutomergeResult?.automerged) {
          return {
            branchExists,
            result: BranchResult.Automerged,
            commitSha,
          };
        }
      } else {
        logger.debug('PR is not configured for automerge');
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (
      err instanceof ExternalHostError ||
      [PLATFORM_RATE_LIMIT_EXCEEDED, REPOSITORY_CHANGED].includes(err.message)
    ) {
      logger.debug('Passing PR error up');
      throw err;
    }
    // Otherwise don't throw here - we don't want to stop the other renovations
    logger.error({ err }, `Error ensuring PR: ${String(err.message)}`);
  }
  if (!branchExists) {
    return {
      branchExists: true,
      prNo: branchPr?.number,
      result: BranchResult.PrCreated,
      commitSha,
    };
  }
  return {
    branchExists,
    prNo: branchPr?.number,
    result: BranchResult.Done,
    commitSha,
  };
}
