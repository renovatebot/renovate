import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../util/git/exec.ts';
import { collectFileChanges } from '../../../util/git/file-changes.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  fileAddition,
  fileChangesToArtifactResults,
} from '../util.ts';

const gitExec = withGitEnvironment();

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`vendir.updateArtifacts(${packageFileName})`);

  const lockFileName = getSiblingFileName(packageFileName, 'vendir.lock.yml');
  if (!lockFileName) {
    logger.warn('No vendir.lock.yml found');
    return null;
  }
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.warn('Empty vendir.lock.yml found');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating Vendir artifacts');
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        { toolName: 'vendir', constraint: config.constraints?.vendir },
        { toolName: 'helm', constraint: config.constraints?.helm },
      ],
    };

    await gitExec(`vendir sync`, execOptions);

    logger.debug('Returning updated Vendir artifacts');

    const fileChanges: UpdateArtifactsResult[] = [];

    const newVendirLockContent = await readLocalFile(lockFileName, 'utf8');
    const isLockFileChanged = existingLockFileContent !== newVendirLockContent;
    if (isLockFileChanged) {
      fileChanges.push(fileAddition(lockFileName, newVendirLockContent));
    }

    // add modified vendir archives to artifacts
    logger.debug("Adding Sync'd files to git");
    const status = await getRepoStatus();
    if (status) {
      fileChanges.push(
        ...fileChangesToArtifactResults(await collectFileChanges(status)),
      );
    } else {
      logger.error('Failed to get git status');
    }

    return fileChanges.length ? fileChanges : null;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Vendir lock file');
    return artifactErrorResult(lockFileName, err);
  }
}
