// TODO #22198
import { isNonEmptyArray } from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global.ts';
import { CONFIG_SECRETS_EXPOSED } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import type { PreparedCommit } from '../../../../modules/platform/types.ts';
import type { CommitFilesConfig } from '../../../../util/git/types.ts';
import { minimatch } from '../../../../util/minimatch.ts';
import { sanitize } from '../../../../util/sanitize.ts';
import type { LongCommitSha } from '../../../../util/schema-utils/git.ts';
import type { BranchConfig } from '../../../types.ts';
import { getPlatformPrOptions } from '../pr/index.ts';

/**
 * Creates the local commit of the branch's updated files, or returns `null` if there is nothing to commit or in dry-run mode.
 */
export async function prepareBranchCommit(
  config: BranchConfig,
): Promise<PreparedCommit | null> {
  let updatedFiles = config.updatedPackageFiles!.concat(
    config.updatedArtifacts!,
  );
  // istanbul ignore if
  if (isNonEmptyArray(config.excludeCommitPaths)) {
    updatedFiles = updatedFiles.filter(({ path: filePath }) => {
      const matchesExcludePaths = config.excludeCommitPaths!.some(
        (excludedPath) =>
          minimatch(excludedPath, { dot: true }).match(filePath),
      );
      if (matchesExcludePaths) {
        logger.debug(`Excluding ${filePath} from commit`);
        return false;
      }
      return true;
    });
  }
  if (!isNonEmptyArray(updatedFiles)) {
    logger.debug(`No files to commit`);
    return null;
  }
  const fileLength = new Set(updatedFiles.map((file) => file.path)).size;
  logger.debug(`${fileLength} file(s) to commit`);
  if (
    config.branchName !== sanitize(config.branchName) ||
    config.commitMessage !== sanitize(config.commitMessage) ||
    config.commitTrailers?.some((trailer) => trailer !== sanitize(trailer))
  ) {
    logger.debug(
      { branchName: config.branchName },
      'Secrets exposed in branchName, commitMessage or commitTrailers',
    );
    throw new Error(CONFIG_SECRETS_EXPOSED);
  }

  const commitFilesConfig: CommitFilesConfig = {
    baseBranch: config.baseBranch,
    branchName: config.branchName,
    files: updatedFiles,
    message: config.commitMessage!,
    trailers: config.commitTrailers,
    force: !!config.forceCommit,
    platformCommit: config.platformCommit,
    // Only needed by Gerrit platform
    prTitle: config.prTitle,
    // Only needed by Gerrit platform
    autoApprove: config.autoApprove,
    // Only needed by GitHub platform
    platformPrOptions: getPlatformPrOptions(config),
  };

  if (GlobalConfig.get('dryRun')) {
    const logExtra = {
      ...commitFilesConfig,
    };

    for (const file of logExtra.files) {
      if (file.type === 'addition') {
        // NOTE that we're copying this field with a different name so we get the raw contents logged, otherwise it'll be logged as `[content]`
        (file as any).rawContents = file.contents;
      }
    }

    logger.info(
      `DRY-RUN: Would commit files to branch ${config.branchName}. See debug logs for raw commit information`,
    );
    logger.debug(
      { ...logExtra },
      `DRY-RUN: Would commit files to branch ${config.branchName}`,
    );
    return null;
  }

  // API will know whether to create new branch or not
  return await scm.prepareCommit(commitFilesConfig);
}

/**
 * Pushes a commit created by `prepareBranchCommit()` and returns the pushed commit SHA, or `null` if nothing was pushed.
 */
export function pushBranchCommit(
  preparedCommit: PreparedCommit,
): Promise<LongCommitSha | null> {
  return preparedCommit.push();
}

/**
 * Commits the branch's updated files and pushes them, returning the pushed commit SHA or `null`.
 */
export async function commitFilesToBranch(
  config: BranchConfig,
): Promise<LongCommitSha | null> {
  const preparedCommit = await prepareBranchCommit(config);
  if (!preparedCommit) {
    return null;
  }
  return await pushBranchCommit(preparedCommit);
}
