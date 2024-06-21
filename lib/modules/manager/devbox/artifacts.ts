import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts(
  updateConfig: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = updateConfig.packageFileName.replace(
    /devbox.json$/,
    'devbox.lock',
  );
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No devbox.lock found');
    return null;
  }
  const execOptions: ExecOptions = {
    cwdFile: updateConfig.packageFileName,
    toolConstraints: [
      {
        toolName: 'devbox',
        constraint: updateConfig.config.constraints?.devbox,
      },
    ],
    docker: {},
    userConfiguredEnv: updateConfig.config.env,
  };

  let cmd = '';
  if (updateConfig.config.isLockFileMaintenance) {
    cmd += 'devbox update';
  } else {
    cmd += 'devbox install';
  }

  try {
    await exec(cmd, execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated devbox.lock');
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: await readLocalFile(lockFileName),
        },
      },
    ];
  } catch (err) {
    logger.warn({ err }, 'Error updating devbox.lock');
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
