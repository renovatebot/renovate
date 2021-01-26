import { execSync } from 'child_process';
import { logger } from '../../../logger';
import {
  deleteLocalFile,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { PostUpdateConfig } from '../../common';
import { WriteExistingFilesResult } from '../../npm/post-update';

const cmd = 'terraform providers lock';
const lockFile = '.terraform.lock.hcl';

// istanbul ignore next
export async function getAdditionalFilesTerraform(
  config: PostUpdateConfig
): Promise<WriteExistingFilesResult> {
  const fileResults: WriteExistingFilesResult = {
    artifactErrors: [],
    updatedArtifacts: [],
  };
  if (await localPathExists(lockFile)) {
    logger.debug('Updating Terraform lock file');
    try {
      // delete lock file, execute lock file creation, update artifact list
      await deleteLocalFile(lockFile);
      const terraformLockOutput = execSync(cmd, {
        cwd: config.localDir,
      });
      logger.trace(terraformLockOutput);
      fileResults.updatedArtifacts.push({
        name: lockFile,
        contents: await readLocalFile(lockFile),
      });
    } catch (e) {
      fileResults.artifactErrors.push(e);
    }
  }
  return fileResults;
}
