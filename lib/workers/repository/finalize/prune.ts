import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { REPOSITORY_CHANGED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { ensureComment } from '../../../modules/platform/comment';
import { scm } from '../../../modules/platform/scm';
import { getBranchList, setUserRepoConfig } from '../../../util/git';
import { escapeRegExp, regEx } from '../../../util/regex';
import { uniqueStrings } from '../../../util/string';
import { getReconfigureBranchName } from '../reconfigure/utils';

async function cleanUpBranches(
  config: RenovateConfig,
  remainingBranches: string[],
): Promise<void> {
  if (!config.pruneStaleBranches) {
    logger.debug('Branch/PR pruning is disabled - skipping');
    return;
  }
  // set Git author in case the repository is not initialized yet
  setUserRepoConfig(config);

  // calculate regex to extract base branch from branch name
  const baseBranchRe = calculateBaseBranchRegex(config);

  for (const branchName of remainingBranches) {
    try {
      // get base branch from branch name if base branches are configured
      // use default branch if no base branches are configured
      // use defaul branch name if no match (can happen when base branches are configured later)
      const baseBranch =
        baseBranchRe?.exec(branchName)?.[1] ?? config.defaultBranch!;
      const pr = await platform.findPr({
        branchName,
        state: 'open',
        targetBranch: baseBranch,
      });
      const branchIsModified = await scm.isBranchModified(
        branchName,
        baseBranch,
      );
      if (pr) {
        if (branchIsModified) {
          logger.debug(
            { prNo: pr.number, prTitle: pr.title },
            'Branch is modified - skipping PR autoclosing',
          );
          if (GlobalConfig.get('dryRun')) {
            logger.info(`DRY-RUN: Would update PR title and ensure comment.`);
          } else {
            if (!pr.title.endsWith('- abandoned')) {
              const newPrTitle = pr.title + ' - abandoned';
              await platform.updatePr({
                number: pr.number,
                prTitle: newPrTitle,
                state: 'open',
              });
            }

            await ensureComment({
              number: pr.number,
              topic: 'Autoclosing Skipped',
              content:
                'This PR has been flagged for autoclosing. However, it is being skipped due to the branch being already modified. Please close/delete it manually or report a bug if you think this is in error.',
            });
          }
        } else if (GlobalConfig.get('dryRun')) {
          logger.info(
            { prNo: pr.number, prTitle: pr.title },
            `DRY-RUN: Would autoclose PR`,
          );
        } else {
          logger.info(
            { branchName, prNo: pr.number, prTitle: pr.title },
            'Autoclosing PR',
          );
          let newPrTitle = pr.title;
          if (!pr.title.endsWith('- autoclosed')) {
            newPrTitle += ' - autoclosed';
          }
          await platform.updatePr({
            number: pr.number,
            prTitle: newPrTitle,
            state: 'closed',
          });
          await scm.deleteBranch(branchName);
        }
      } else if (branchIsModified) {
        logger.debug('Orphan Branch is modified - skipping branch deletion');
      } else if (GlobalConfig.get('dryRun')) {
        logger.info(`DRY-RUN: Would delete orphan branch ${branchName}`);
      } else {
        logger.info({ branch: branchName }, `Deleting orphan branch`);
        await scm.deleteBranch(branchName);
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.message === 'config-validation') {
        logger.debug(
          'Cannot prune branch due to collision between tags and branch names',
        );
      } else if (err.message?.includes("bad revision 'origin/")) {
        logger.debug(
          { branchName },
          'Branch not found on origin when attempting to prune',
        );
      } else if (err.message !== REPOSITORY_CHANGED) {
        logger.warn({ err, branch: branchName }, 'Error pruning branch');
      }
    }
  }
}

/**
 * Calculates a {RegExp} to extract the base branch from a branch name if base branches are configured.
 * @param config Renovate configuration
 */
function calculateBaseBranchRegex(config: RenovateConfig): RegExp | null {
  if (!config.baseBranchPatterns?.length) {
    return null;
  }

  // calculate possible branch prefixes and escape for regex
  const branchPrefixes = [config.branchPrefix, config.branchPrefixOld]
    .filter(is.nonEmptyStringAndNotWhitespace)
    .filter(uniqueStrings)
    .map(escapeRegExp);

  // calculate possible base branches and escape for regex
  const baseBranches = config.baseBranchPatterns.map(escapeRegExp);

  // create regex to extract base branche from branch name
  const baseBranchRe = regEx(
    `^(?:${branchPrefixes.join('|')})(${baseBranches.join('|')})-`,
  );

  return baseBranchRe;
}

export async function pruneStaleBranches(
  config: RenovateConfig,
  branchList: string[] | null | undefined,
): Promise<void> {
  logger.debug('Removing any stale branches');
  logger.trace({ config }, `pruneStaleBranches`);
  // TODO: types (#22198)
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded!}`);
  if (!branchList) {
    logger.debug('No branchList');
    return;
  }
  // TODO: types (#22198)
  let renovateBranches = getBranchList().filter(
    (branchName) =>
      branchName.startsWith(config.branchPrefix!) &&
      branchName !== getReconfigureBranchName(config.branchPrefix!),
  );
  if (!renovateBranches?.length) {
    logger.debug('No renovate branches found');
    return;
  }
  logger.debug(
    {
      branchList: branchList?.sort(),
      renovateBranches: renovateBranches?.sort(),
    },
    'Branch lists',
  );
  // TODO: types (#22198)
  const lockFileBranch = `${config.branchPrefix!}lock-file-maintenance`;
  renovateBranches = renovateBranches.filter(
    (branch) => branch !== lockFileBranch,
  );
  const remainingBranches = renovateBranches.filter(
    (branch) => !branchList.includes(branch),
  );
  logger.debug(`remainingBranches=${String(remainingBranches)}`);
  if (remainingBranches.length === 0) {
    logger.debug('No branches to clean up');
    return;
  }

  await cleanUpBranches(config, remainingBranches);
}
