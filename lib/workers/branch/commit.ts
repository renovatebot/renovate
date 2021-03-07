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
  // istanbul ignore if
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
  }
  if (!is.nonEmptyArray(updatedFiles)) {
    logger.debug(`No files to commit`);
    return null;
  }
  const fileLength = [...new Set(updatedFiles.map((file) => file.name))].length;
  logger.debug(`${fileLength} file(s) to commit`);
  if (getAdminConfig().dryRun) {
    logger.info(
      {
        commitMessage: config.commitMessage,

        // Piping f.contents to
        // git diff -- ${f.name} -
        // would be much better, but this seems to be impossible with simple-git
        updatedFiles: `\n${updatedFiles
          .map((f) => `${f.name}\n<<<\n${String(f.contents)}\n>>>\n`)
          .join('\n')}\n`,
      },
      'DRY-RUN: Would commit files to branch ' + config.branchName
    );
    return null;
  }
  // istanbul ignore if
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
