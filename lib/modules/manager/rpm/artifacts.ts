import type { UpdateArtifact, UpdateArtifactsResult } from "../types";
import { logger } from "../../../logger";
import { deleteLocalFile, readLocalFile } from "../../../util/fs";
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`rpm.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (!isLockFileMaintenance) {
    logger.debug('Must be in lockFileMaintenance for rpm manager');
    return null;
  }

  let lockFileName = "rpms.lock.yaml";
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');

  logger.debug(`Updating ${lockFileName}`);

  const cmd: string[] = [];

  try {
    await deleteLocalFile(lockFileName);

    // TODO: Doesn't have to be Dockerfile only
    cmd.push('rpm-lockfile-prototype -f Dockerfile rpms.in.yaml');

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,

    }

    await exec(cmd, execOptions);

    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');

    if (existingLockFileContent === newLockFileContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }

    logger.debug(`Returning updated ${lockFileName}`);

    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        }
      }
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}
