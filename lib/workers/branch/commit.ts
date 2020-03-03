import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { platform } from '../../platform';
import { logger } from '../../logger';
import { BranchConfig } from '../common';

export async function commitFilesToBranch(
  config: BranchConfig
): Promise<string | null> {
  let updatedFiles = config.updatedPackageFiles.concat(config.updatedArtifacts);
  // istanbul ignore if
  if (is.nonEmptyArray(config.excludeCommitPaths)) {
    updatedFiles = updatedFiles.filter(f => {
      const filename = f.name === '|delete|' ? f.contents.toString() : f.name;
      const matchesExcludePaths = config.excludeCommitPaths.some(path =>
        minimatch(filename, path, { dot: true })
      );
      if (matchesExcludePaths) {
        logger.debug(`Excluding ${filename} from commit`);
        return false;
      }
      return true;
    });
  }
  if (!is.nonEmptyArray(updatedFiles)) {
    logger.debug(`No files to commit`);
    return null;
  }
  logger.debug(`${updatedFiles.length} file(s) to commit`);
  // istanbul ignore if
  if (config.dryRun) {
    logger.info('DRY-RUN: Would commit files to branch ' + config.branchName);
    return null;
  }
  // API will know whether to create new branch or not
  return platform.commitFilesToBranch({
    branchName: config.branchName,
    files: updatedFiles,
    message: config.commitMessage,
    parentBranch: config.baseBranch || undefined,
  });
}
