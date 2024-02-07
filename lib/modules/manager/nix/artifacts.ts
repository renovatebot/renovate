import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { logger } from '../../../logger';
import { findGithubToken } from '../../../util/check-token';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
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

  let cmd = `nix \
    --extra-experimental-features nix-command \
    --extra-experimental-features flakes `;

  const token = findGithubToken(
    hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }),
  );

  if (token) {
    cmd += `--extra-access-tokens github.com=${token} `;
  }

  if (config.isLockFileMaintenance) {
    cmd += 'flake update';
  } else {
    const inputs = updatedDeps
      .map(({ depName }) => depName)
      .filter(is.nonEmptyStringAndNotWhitespace)
      .map((depName) => `--update-input ${quote(depName)}`)
      .join(' ');
    cmd += `flake lock ${inputs}`;
  }
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    toolConstraints: [
      {
        toolName: 'nix',
        constraint: config.constraints?.nix,
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
