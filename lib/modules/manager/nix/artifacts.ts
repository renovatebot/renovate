import is from '@sindresorhus/is';
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
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = packageFileName.replace(regEx(/\.nix$/), '.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No flake.lock found');
    return null;
  }

  let cmd: string;

  if (config.isLockFileMaintenance) {
    cmd = `nix \
    --extra-experimental-features nix-command \
    --extra-experimental-features flakes \
    flake update`;
  } else {
    const inputs = updatedDeps
      .map(({ depName }) => depName)
      .filter(is.nonEmptyStringAndNotWhitespace)
      .map((depName) => `--update-input ${depName}`)
      .join(' ');
    cmd = `nix \
    --extra-experimental-features nix-command \
    --extra-experimental-features flakes \
    flake lock ${inputs}`;
  }
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    env: {
      PATH: `/home/jamie/.local/bin:${process.env.PATH!}`,
    },
    toolConstraints: [
      {
        toolName: 'nix',
        constraint: config.constraints?.nix,
      },
    ],
    docker: {
      image: 'sidecar',
    },
  };

  try {
    await exec(cmd, execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated flake.lock');
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
    logger.warn({ err }, 'Error updating flake.lock');
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
