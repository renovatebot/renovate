import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts({
  packageFileName,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = packageFileName.replace(regEx(/\.nix$/), '.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No devenv.lock found');
    return null;
  }

  // devenv update updates all inputs at once
  // there's no documented way to update individual inputs
  const cmd = 'devenv update';

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    toolConstraints: [
      {
        toolName: 'devenv',
        constraint: config.constraints?.devenv,
      },
    ],
    docker: {},
  };

  try {
    await exec(cmd, execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated devenv.lock');
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
    logger.warn({ err }, 'Error updating devenv.lock');
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
