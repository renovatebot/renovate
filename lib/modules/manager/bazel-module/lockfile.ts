import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { deleteLocalFile, readLocalFile } from '../../../util/fs/index.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import type { UpdateArtifactsResult } from '../types.ts';

export async function updateBazelLockfile(
  lockFileName: string,
  cwdFile: string,
  isLockFileMaintenance: boolean | undefined,
  bazeliskConstraint: string | undefined,
): Promise<UpdateArtifactsResult[] | null> {
  try {
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

    const execOptions: ExecOptions = {
      cwdFile,
      docker: {},
      toolConstraints: [
        { toolName: 'bazelisk', constraint: bazeliskConstraint },
      ],
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
