import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { readLocalFile, writeLocalFile } from '../../../util/fs/index.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`bazel-module.updateArtifacts(${packageFileName})`);
  const lockFileName = packageFileName.replace(
    regEx(/MODULE\.bazel$/),
    'MODULE.bazel.lock',
  );

  const existingLockContent = await readLocalFile(lockFileName);
  if (!existingLockContent) {
    logger.debug('No MODULE.bazel.lock found - skipping artifact update');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [{ toolName: 'bazelisk' }],
    };
    await exec('bazel mod deps', execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }

    const newLockContent = await readLocalFile(lockFileName);
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
    logger.debug({ err }, 'Failed to update MODULE.bazel.lock');
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
