import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { getAdminConfig } from '../../config/admin';
import { CONFIG_SECRETS_EXPOSED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { commitFiles } from '../../util/git';
import { sanitize } from '../../util/sanitize';
import type { BranchConfig } from '../types';

export function commitFilesToBranch(
  config: BranchConfig
): Promise<string | null> {
  let updatedFiles = config.updatedPackageFiles.concat(config.updatedArtifacts);
  /* c8 ignore start */
  if (is.nonEmptyArray(config.excludeCommitPaths)) {
    updatedFiles = updatedFiles.filter((f) => {
      const filename = f.name === '|delete|' ? f.contents.toString() : f.name;
      const matchesExcludePaths = config.excludeCommitPaths.some((path) =>
        minimatch(filename, path, { dot: true })
      );
      if (matchesExcludePaths) {
        logger.debug(`Excluding ${filename} from commit`);
        return false;
      }
      return true;
    });
  } /* c8 ignore stop */
  if (!is.nonEmptyArray(updatedFiles)) {
    logger.debug(`No files to commit`);
    return null;
  }
  const fileLength = [...new Set(updatedFiles.map((file) => file.name))].length;
  logger.debug(`${fileLength} file(s) to commit`);
  /* c8 ignore next 4 */
  if (getAdminConfig().dryRun) {
    logger.info('DRY-RUN: Would commit files to branch ' + config.branchName);
    return null;
  }
  /* c8 ignore next 6 */
  if (
    config.branchName !== sanitize(config.branchName) ||
    config.commitMessage !== sanitize(config.commitMessage)
  ) {
    throw new Error(CONFIG_SECRETS_EXPOSED);
  }
  // API will know whether to create new branch or not
  return commitFiles({
    branchName: config.branchName,
    files: updatedFiles,
    message: config.commitMessage,
    force: !!config.forceCommit,
  });
}
