import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  statLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../util/git/exec.ts';
import { collectFileChanges } from '../../../util/git/file-changes.ts';
import { getRepoStatus, isFileModeEnabled } from '../../../util/git/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  fileAddition,
  fileChangesToArtifactResults,
  resolveToolConstraint,
} from '../util.ts';

const gitExec = withGitEnvironment();
const ownerExecutePermission = 0o100;

async function detectExecutable(
  path: string,
  canReadFileMode: boolean,
): Promise<true | undefined> {
  if (!canReadFileMode) {
    return undefined;
  }

  const fileStats = await statLocalFile(path);
  if (!fileStats?.isFile()) {
    return undefined;
  }

  if ((fileStats.mode & ownerExecutePermission) === 0) {
    return undefined;
  }

  // Git derives its executable flag from the owner's execute permission.
  return true;
}

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
        {
          toolName: 'vendir',
          constraint: await resolveToolConstraint(config, 'vendir'),
        },
        {
          toolName: 'helm',
          constraint: await resolveToolConstraint(config, 'helm'),
        },
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
      const canReadFileMode = await isFileModeEnabled();
      const changes = await collectFileChanges(status, {
        additionMetadata: async (f) => ({
          isExecutable: await detectExecutable(f, canReadFileMode),
        }),
      });
      fileChanges.push(...fileChangesToArtifactResults(changes));
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
