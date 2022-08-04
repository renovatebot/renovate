// TODO #7154
import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { GlobalConfig } from '../../../../config/global';
import { CONFIG_SECRETS_EXPOSED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import { sanitize } from '../../../../util/sanitize';
import type { BranchConfig } from '../../../types';

export function commitFilesToBranch(
  config: BranchConfig
): Promise<string | null> {
  let updatedFiles = config.updatedPackageFiles!.concat(
    config.updatedArtifacts!
  );
  // istanbul ignore if
  if (is.nonEmptyArray(config.excludeCommitPaths)) {
    updatedFiles = updatedFiles.filter(({ path: filePath }) => {
      const matchesExcludePaths = config.excludeCommitPaths!.some(
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
    if (config.recreateMergedPr) {
      // force push
      logger.debug('Force push changes because we are recreating a mergedPR.');
      try {
        return commitAndPush({
          branchName: config.branchName,
          files: updatedFiles,
          message: config.commitMessage!,
          force: true,
          platformCommit: !!config.platformCommit,
        });
      } catch (err) {
        logger.debug(err.message);
      }
    }
    return Promise.resolve(null);
  }
  const fileLength = [...new Set(updatedFiles.map((file) => file.path))].length;
  logger.debug(`${fileLength} file(s) to commit`);
  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to branch ' + config.branchName);
    return Promise.resolve(null);
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
  // eslint-disable-next-line no-console
  console.log('NEEDS COMMITING');
  // API will know whether to create new branch or not
  return commitAndPush({
    branchName: config.branchName,
    files: updatedFiles,
    message: config.commitMessage!,
    force: !!config.forceCommit,
    platformCommit: !!config.platformCommit,
  });
}
