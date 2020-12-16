import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import minimatch from 'minimatch';
import { RenovateConfig } from '../../config';
import {
  MANAGER_LOCKFILE_ERROR,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  WORKER_FILE_UPDATE_FAILED,
} from '../../constants/error-messages';
import { addMeta, logger, removeMeta } from '../../logger';
import { getAdditionalFiles } from '../../manager/npm/post-update';
import { Pr, platform } from '../../platform';
import { BranchStatus, PrState } from '../../types';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { emojify } from '../../util/emoji';
import { exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import {
  checkoutBranch,
  deleteBranch,
  getRepoStatus,
  branchExists as gitBranchExists,
  isBranchModified,
} from '../../util/git';
import { regEx } from '../../util/regex';
import * as template from '../../util/template';
import { BranchConfig, PrResult, ProcessBranchResult } from '../common';
import { Limit, isLimitReached } from '../global/limits';
import { checkAutoMerge, ensurePr, getPlatformPrOptions } from '../pr';
import { tryBranchAutomerge } from './automerge';
import { prAlreadyExisted } from './check-existing';
import { commitFilesToBranch } from './commit';
import { getUpdatedPackageFiles } from './get-updated';
import { shouldReuseExistingBranch } from './reuse';
import { isScheduledNow } from './schedule';
import { setStability } from './status-checks';

function rebaseCheck(config: RenovateConfig, branchPr: Pr): boolean {
  const titleRebase = branchPr.title?.startsWith('rebase!');
  const labelRebase = branchPr.labels?.includes(config.rebaseLabel);
  const prRebaseChecked = branchPr.body?.includes(
    `- [x] <!-- rebase-check -->`
  );

  return titleRebase || labelRebase || prRebaseChecked;
}

const rebasingRegex = /\*\*Rebasing\*\*: .*/;

async function deleteBranchSilently(branchName: string): Promise<void> {
  try {
    await deleteBranch(branchName);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ branchName, err }, 'Branch auto-remove failed');
  }
}

export async function processBranch(
  branchConfig: BranchConfig
): Promise<ProcessBranchResult> {
  const config: BranchConfig = { ...branchConfig };
  const dependencies = config.upgrades
    .map((upgrade) => upgrade.depName)
    .filter((v) => v) // remove nulls (happens for lock file maintenance)
    .filter((value, i, list) => list.indexOf(value) === i); // remove duplicates
  logger.debug(
    { dependencies },
    `processBranch with ${branchConfig.upgrades.length} upgrades`
  );
  logger.trace({ config }, 'branch config');
  await checkoutBranch(config.baseBranch);
  const branchExists = gitBranchExists(config.branchName);
  const branchPr = await platform.getBranchPr(config.branchName);
  logger.debug(`branchExists=${branchExists}`);
  const dependencyDashboardCheck = (config.dependencyDashboardChecks || {})[
    config.branchName
  ];
  // istanbul ignore if
  if (dependencyDashboardCheck) {
    logger.debug(
      'Branch has been checked in Dependency Dashboard: ' +
        dependencyDashboardCheck
    );
  }
  if (branchPr) {
    config.rebaseRequested = rebaseCheck(config, branchPr);
    logger.debug(`Branch pr rebase requested: ${config.rebaseRequested}`);
  }
  try {
    logger.debug(`Branch has ${dependencies.length} upgrade(s)`);

    // Check if branch already existed
    const existingPr = branchPr ? undefined : await prAlreadyExisted(config);
    if (existingPr && !dependencyDashboardCheck) {
      logger.debug(
        { prTitle: config.prTitle },
        'Closed PR already exists. Skipping branch.'
      );
      if (existingPr.state === PrState.Closed) {
        const topic = `Renovate Ignore Notification`;
        let content;
        if (config.updateType === 'major') {
          content = `As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for *any* future ${config.newMajor}.x releases. However, if you upgrade to ${config.newMajor}.x manually then Renovate will then reenable updates for minor and patch updates automatically.`;
        } else if (config.updateType === 'digest') {
          content = `As this PR has been closed unmerged, Renovate will ignore this upgrade updateType and you will not receive PRs for *any* future ${config.depName}:${config.currentValue} digest updates. Digest updates will resume if you update the specified tag at any time.`;
        } else {
          content = `As this PR has been closed unmerged, Renovate will now ignore this update (${config.newValue}). You will still receive a PR once a newer version is released, so if you wish to permanently ignore this dependency, please add it to the \`ignoreDeps\` array of your renovate config.`;
        }
        content +=
          '\n\nIf this PR was closed by mistake or you changed your mind, you can simply rename this PR and you will soon get a fresh replacement PR opened.';
        if (!config.suppressNotifications.includes('prIgnoreNotification')) {
          if (config.dryRun) {
            logger.info(
              `DRY-RUN: Would ensure closed PR comment in PR #${existingPr.number}`
            );
          } else {
            await platform.ensureComment({
              number: existingPr.number,
              topic,
              content,
            });
          }
        }
        if (branchExists) {
          if (config.dryRun) {
            logger.info('DRY-RUN: Would delete branch ' + config.branchName);
          } else {
            await deleteBranch(config.branchName);
          }
        }
      } else if (existingPr.state === PrState.Merged) {
        logger.debug(
          { pr: existingPr.number },
          'Merged PR is blocking this branch'
        );
      }
      return ProcessBranchResult.AlreadyExisted;
    }
    // istanbul ignore if
    if (!branchExists && config.dependencyDashboardApproval) {
      if (dependencyDashboardCheck) {
        logger.debug(`Branch ${config.branchName} is approved for creation`);
      } else {
        logger.debug(`Branch ${config.branchName} needs approval`);
        return ProcessBranchResult.NeedsApproval;
      }
    }
    if (
      !branchExists &&
      isLimitReached(Limit.Branches) &&
      !dependencyDashboardCheck &&
      !config.vulnerabilityAlert
    ) {
      logger.debug('Reached branch limit - skipping branch creation');
      return ProcessBranchResult.BranchLimitReached;
    }
    if (
      isLimitReached(Limit.Commits) &&
      !dependencyDashboardCheck &&
      !config.vulnerabilityAlert
    ) {
      logger.debug('Reached commits limit - skipping branch');
      return ProcessBranchResult.CommitLimitReached;
    }
    if (branchExists) {
      logger.debug('Checking if PR has been edited');
      if (branchPr) {
        logger.debug('Found existing branch PR');
        if (branchPr.state !== PrState.Open) {
          logger.debug(
            'PR has been closed or merged since this run started - aborting'
          );
          throw new Error(REPOSITORY_CHANGED);
        }
        const branchIsModified = await isBranchModified(config.branchName);
        if (
          branchIsModified ||
          (branchPr.targetBranch &&
            branchPr.targetBranch !== branchConfig.baseBranch)
        ) {
          logger.debug({ prNo: branchPr.number }, 'PR has been edited');
          if (dependencyDashboardCheck || config.rebaseRequested) {
            logger.debug('Manual rebase has been requested for PR');
          } else {
            const newBody = branchPr.body?.replace(
              rebasingRegex,
              '**Rebasing**: Renovate will not automatically rebase this PR, because other commits have been found.'
            );
            if (newBody !== branchPr.body) {
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
            return ProcessBranchResult.PrEdited;
          }
        }
      }
    }

    // Check schedule
    config.isScheduledNow = isScheduledNow(config);
    if (!config.isScheduledNow && !dependencyDashboardCheck) {
      if (!branchExists) {
        logger.debug('Skipping branch creation as not within schedule');
        return ProcessBranchResult.NotScheduled;
      }
      if (config.updateNotScheduled === false && !config.rebaseRequested) {
        logger.debug('Skipping branch update as not within schedule');
        return ProcessBranchResult.NotScheduled;
      }
      // istanbul ignore if
      if (!branchPr) {
        logger.debug('Skipping PR creation out of schedule');
        return ProcessBranchResult.NotScheduled;
      }
      logger.debug(
        'Branch + PR exists but is not scheduled -- will update if necessary'
      );
    }

    if (
      config.upgrades.some(
        (upgrade) => upgrade.stabilityDays && upgrade.releaseTimestamp
      )
    ) {
      // Only set a stability status check if one or more of the updates contain
      // both a stabilityDays setting and a releaseTimestamp
      config.stabilityStatus = BranchStatus.green;
      // Default to 'success' but set 'pending' if any update is pending
      const oneDay = 24 * 60 * 60 * 1000;
      for (const upgrade of config.upgrades) {
        if (upgrade.stabilityDays && upgrade.releaseTimestamp) {
          const daysElapsed = Math.floor(
            (new Date().getTime() -
              new Date(upgrade.releaseTimestamp).getTime()) /
              oneDay
          );
          if (
            !dependencyDashboardCheck &&
            daysElapsed < upgrade.stabilityDays
          ) {
            logger.debug(
              {
                depName: upgrade.depName,
                daysElapsed,
                stabilityDays: upgrade.stabilityDays,
              },
              'Update has not passed stability days'
            );
            config.stabilityStatus = BranchStatus.yellow;
          }
        }
      }
      // Don't create a branch if we know it will be status ProcessBranchResult.Pending
      if (
        !dependencyDashboardCheck &&
        !branchExists &&
        config.stabilityStatus === BranchStatus.yellow &&
        ['not-pending', 'status-success'].includes(config.prCreation)
      ) {
        logger.debug('Skipping branch creation due to stability days not met');
        return ProcessBranchResult.Pending;
      }
    }

    // istanbul ignore if
    if (
      dependencyDashboardCheck === 'rebase' ||
      config.dependencyDashboardRebaseAllOpen
    ) {
      logger.debug('Manual rebase requested via Dependency Dashboard');
      config.reuseExistingBranch = false;
    } else {
      Object.assign(config, await shouldReuseExistingBranch(config));
    }
    logger.debug(`Using reuseExistingBranch: ${config.reuseExistingBranch}`);
    const res = await getUpdatedPackageFiles(config);
    // istanbul ignore if
    if (res.artifactErrors && config.artifactErrors) {
      res.artifactErrors = config.artifactErrors.concat(res.artifactErrors);
    }
    Object.assign(config, res);
    if (config.updatedPackageFiles?.length) {
      logger.debug(
        `Updated ${config.updatedPackageFiles.length} package files`
      );
    } else {
      logger.debug('No package files need updating');
    }
    const additionalFiles = await getAdditionalFiles(
      config,
      branchConfig.packageFiles
    );
    config.artifactErrors = (config.artifactErrors || []).concat(
      additionalFiles.artifactErrors
    );
    config.updatedArtifacts = (config.updatedArtifacts || []).concat(
      additionalFiles.updatedArtifacts
    );
    if (config.updatedArtifacts?.length) {
      logger.debug(
        {
          updatedArtifacts: config.updatedArtifacts.map((f) =>
            f.name === '|delete|' ? `${String(f.contents)} (delete)` : f.name
          ),
        },
        `Updated ${config.updatedArtifacts.length} lock files`
      );
    } else {
      logger.debug('No updated lock files in branch');
    }

    if (
      /* Only run post-upgrade tasks if there are changes to package files... */
      (config.updatedPackageFiles?.length > 0 ||
        /* ... or changes to artifacts */
        config.updatedArtifacts?.length > 0) &&
      global.trustLevel === 'high' &&
      is.nonEmptyArray(config.allowedPostUpgradeCommands)
    ) {
      for (const upgrade of config.upgrades) {
        addMeta({ dep: upgrade.depName });
        logger.trace(
          {
            tasks: upgrade.postUpgradeTasks,
            allowedCommands: config.allowedPostUpgradeCommands,
          },
          'Checking for post-upgrade tasks'
        );
        const commands = upgrade.postUpgradeTasks.commands || [];
        const fileFilters = upgrade.postUpgradeTasks.fileFilters || [];

        if (is.nonEmptyArray(commands)) {
          // Persist updated files in file system so any executed commands can see them
          for (const file of config.updatedPackageFiles.concat(
            config.updatedArtifacts
          )) {
            if (file.name !== '|delete|') {
              let contents;
              if (typeof file.contents === 'string') {
                contents = Buffer.from(file.contents);
              } else {
                contents = file.contents;
              }
              await writeLocalFile(file.name, contents);
            }
          }

          for (const cmd of commands) {
            if (
              !config.allowedPostUpgradeCommands.some((pattern) =>
                regEx(pattern).test(cmd)
              )
            ) {
              logger.warn(
                {
                  cmd,
                  allowedPostUpgradeCommands: config.allowedPostUpgradeCommands,
                },
                'Post-upgrade task did not match any on allowed list'
              );
            } else {
              const compiledCmd = config.allowPostUpgradeCommandTemplating
                ? template.compile(cmd, upgrade)
                : cmd;

              logger.debug({ cmd: compiledCmd }, 'Executing post-upgrade task');

              const execResult = await exec(compiledCmd, {
                cwd: config.localDir,
              });

              logger.debug(
                { cmd: compiledCmd, ...execResult },
                'Executed post-upgrade task'
              );
            }
          }

          const status = await getRepoStatus();

          for (const relativePath of status.modified.concat(status.not_added)) {
            for (const pattern of fileFilters) {
              if (minimatch(relativePath, pattern)) {
                logger.debug(
                  { file: relativePath, pattern },
                  'Post-upgrade file saved'
                );
                const existingContent = await readLocalFile(relativePath);
                const existingUpdatedArtifacts = config.updatedArtifacts.find(
                  (ua) => ua.name === relativePath
                );
                if (existingUpdatedArtifacts) {
                  existingUpdatedArtifacts.contents = existingContent;
                } else {
                  config.updatedArtifacts.push({
                    name: relativePath,
                    contents: existingContent,
                  });
                }
                // If the file is deleted by a previous post-update command, remove the deletion from updatedArtifacts
                config.updatedArtifacts = config.updatedArtifacts.filter(
                  (ua) => ua.name !== '|delete|' || ua.contents !== relativePath
                );
              }
            }
          }

          for (const relativePath of status.deleted || []) {
            for (const pattern of fileFilters) {
              if (minimatch(relativePath, pattern)) {
                logger.debug(
                  { file: relativePath, pattern },
                  'Post-upgrade file removed'
                );
                config.updatedArtifacts.push({
                  name: '|delete|',
                  contents: relativePath,
                });
                // If the file is created or modified by a previous post-update command, remove the modification from updatedArtifacts
                config.updatedArtifacts = config.updatedArtifacts.filter(
                  (ua) => ua.name !== relativePath
                );
              }
            }
          }
        }
      }
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
    }
    config.forceCommit =
      !!dependencyDashboardCheck ||
      config.rebaseRequested ||
      branchPr?.isConflicted;
    const commitSha = await commitFilesToBranch(config);
    // istanbul ignore if
    if (branchPr && platform.refreshPr) {
      await platform.refreshPr(branchPr.number);
    }
    if (!commitSha && !branchExists) {
      return ProcessBranchResult.NoWork;
    }
    if (commitSha) {
      const action = branchExists ? 'updated' : 'created';
      logger.info({ commitSha }, `Branch ${action}`);
    }
    // Set branch statuses
    await setStability(config);

    // break if we pushed a new commit because status check are pretty sure pending but maybe not reported yet
    if (
      !dependencyDashboardCheck &&
      !config.rebaseRequested &&
      commitSha &&
      (config.requiredStatusChecks?.length || config.prCreation !== 'immediate')
    ) {
      logger.debug({ commitSha }, `Branch status pending`);
      return ProcessBranchResult.Pending;
    }

    // Try to automerge branch and finish if successful, but only if branch already existed before this run
    if (branchExists || !config.requiredStatusChecks) {
      const mergeStatus = await tryBranchAutomerge(config);
      logger.debug(`mergeStatus=${mergeStatus}`);
      if (mergeStatus === 'automerged') {
        await deleteBranchSilently(config.branchName);
        logger.debug('Branch is automerged - returning');
        return ProcessBranchResult.Automerged;
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
      return ProcessBranchResult.Error;
    } else if (
      err.messagee &&
      err.message.includes('fatal: Authentication failed')
    ) {
      throw new Error(PLATFORM_AUTHENTICATION_ERROR);
    } else if (err.message?.includes('fatal: bad revision')) {
      logger.debug({ err }, 'Aborting job due to bad revision error');
      throw new Error(REPOSITORY_CHANGED);
    } else if (!(err instanceof ExternalHostError)) {
      logger.error({ err }, `Error updating branch: ${String(err.message)}`);
    }
    // Don't throw here - we don't want to stop the other renovations
    return ProcessBranchResult.Error;
  }
  try {
    logger.debug('Ensuring PR');
    logger.debug(
      `There are ${config.errors.length} errors and ${config.warnings.length} warnings`
    );
    const { prResult: result, pr } = await ensurePr(config);
    if (result === PrResult.LimitReached) {
      logger.debug('Reached PR limit - skipping PR creation');
      return ProcessBranchResult.PrLimitReached;
    }
    // TODO: ensurePr should check for automerge itself
    if (result === PrResult.AwaitingApproval) {
      return ProcessBranchResult.NeedsPrApproval;
    }
    if (
      result === PrResult.AwaitingGreenBranch ||
      result === PrResult.AwaitingNotPending
    ) {
      return ProcessBranchResult.Pending;
    }
    if (pr) {
      const topic = emojify(':warning: Artifact update problem');
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
          ' - you check the rebase/retry checkbox if found above, or\n';
        content +=
          ' - you rename this PR\'s title to start with "rebase!" to trigger it manually';
        content += '\n\nThe artifact failure details are included below:\n\n';
        config.artifactErrors.forEach((error) => {
          content += `##### File name: ${error.lockFile}\n\n`;
          content += `\`\`\`\n${error.stderr}\n\`\`\`\n\n`;
        });
        content = platform.getPrBody(content);
        if (
          !(
            config.suppressNotifications.includes('artifactErrors') ||
            config.suppressNotifications.includes('lockFileErrors')
          )
        ) {
          if (config.dryRun) {
            logger.info(
              `DRY-RUN: Would ensure lock file error comment in PR #${pr.number}`
            );
          } else {
            await platform.ensureComment({
              number: pr.number,
              topic,
              content,
            });
          }
        }
        const context = `renovate/artifacts`;
        const description = 'Artifact file update failure';
        const state = BranchStatus.red;
        const existingState = await platform.getBranchStatusCheck(
          config.branchName,
          context
        );
        // Check if state needs setting
        if (existingState !== state) {
          logger.debug(`Updating status check state to failed`);
          if (config.dryRun) {
            logger.info(
              'DRY-RUN: Would set branch status in ' + config.branchName
            );
          } else {
            await platform.setBranchStatus({
              branchName: config.branchName,
              context,
              description,
              state,
            });
          }
        }
      } else {
        if (config.updatedArtifacts?.length) {
          // istanbul ignore if
          if (config.dryRun) {
            logger.info(
              `DRY-RUN: Would ensure comment removal in PR #${pr.number}`
            );
          } else {
            // Remove artifacts error comment only if this run has successfully updated artifacts
            await platform.ensureCommentRemoval({ number: pr.number, topic });
          }
        }
        const prAutomerged = await checkAutoMerge(pr, config);
        if (prAutomerged && config.automergeType !== 'pr-comment') {
          await deleteBranchSilently(config.branchName);
          return ProcessBranchResult.Automerged;
        }
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
    return ProcessBranchResult.PrCreated;
  }
  return ProcessBranchResult.Done;
}
