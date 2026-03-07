import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`bazelisk.updateArtifacts(${packageFileName})`);

  if (!updatedDeps.length && !config.isLockFileMaintenance) {
    logger.debug('No updated bazelisk deps - returning null');
    return null;
  }

  const moduleFileName = getSiblingFileName(packageFileName, 'MODULE.bazel');
  const existingModuleContent = await readLocalFile(moduleFileName, 'utf8');
  if (!existingModuleContent) {
    logger.debug('No MODULE.bazel found - skipping artifact update');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'MODULE.bazel.lock');
  const existingLockContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockContent) {
    logger.debug('No MODULE.bazel.lock found - skipping artifact update');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const execOptions: ExecOptions = {
      cwdFile: moduleFileName,
      docker: {},
      toolConstraints: [{ toolName: 'bazelisk' }],
    };
    await exec('bazel mod deps', execOptions);

    const status = await getRepoStatus();
    if (
      !status.modified.includes(lockFileName) &&
      !status.not_added?.includes(lockFileName)
    ) {
      return null;
    }

    const newLockContent = await readLocalFile(lockFileName, 'utf8');
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockContent,
        },
      },
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn(
      { lockFile: lockFileName, err },
      'Failed to update MODULE.bazel.lock',
    );
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
