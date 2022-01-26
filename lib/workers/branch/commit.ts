import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { GlobalConfig } from '../../config/global';
import { CONFIG_SECRETS_EXPOSED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { platform } from '../../platform';
import { commitFiles } from '../../util/git';
import type { CommitFilesConfig } from '../../util/git/types';
import { sanitize } from '../../util/sanitize';
import type { BranchConfig } from '../types';

export function commitFilesToBranch(
  config: BranchConfig
): Promise<string | null> {
  let updatedFiles = config.updatedPackageFiles.concat(config.updatedArtifacts);
  // istanbul ignore if
  if (is.nonEmptyArray(config.excludeCommitPaths)) {
    updatedFiles = updatedFiles.filter(({ path: filePath }) => {
      const matchesExcludePaths = config.excludeCommitPaths.some(
        (excludedPath) => minimatch(filePath, excludedPath, { dot: true })
      );
      if (matchesExcludePaths) {
        logger.debug(`Excluding ${filePath} from commit`);
        return false;
      }
      return true;
    });
  }
  if (!is.nonEmptyArray(updatedFiles)) {
    logger.debug(`No files to commit`);
    return null;
  }
  const fileLength = [...new Set(updatedFiles.map((file) => file.path))].length;
  logger.debug(`${fileLength} file(s) to commit`);
  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to branch ' + config.branchName);
    return null;
  }
  // istanbul ignore if
  if (
    config.branchName !== sanitize(config.branchName) ||
    config.commitMessage !== sanitize(config.commitMessage)
  ) {
    logger.debug(
      { branchName: config.branchName },
      'Secrets exposed in branchName or commitMessage'
    );
    throw new Error(CONFIG_SECRETS_EXPOSED);
  }

  const commitConfig: CommitFilesConfig = {
    branchName: config.branchName,
    files: updatedFiles,
    message: config.commitMessage,
    force: !!config.forceCommit,
  };

  // API will know whether to create new branch or not
  return config.platformCommit && platform.commitFiles
    ? platform.commitFiles(commitConfig)
    : commitFiles(commitConfig);
}
