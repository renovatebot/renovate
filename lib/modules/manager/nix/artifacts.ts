import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { quote } from 'shlex';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { getGitEnvironmentVariables } from '../../../util/git/auth.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts({
  packageFileName,
  config,
  updatedDeps,
  newPackageFileContent,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getSiblingFileName(packageFileName, 'flake.lock');
  const existingLockFileContent = await readLocalFile(lockFileName);

  logger.trace({ packageFileName, updatedDeps }, 'nix.updateArtifacts');

  if (!existingLockFileContent) {
    logger.debug('No flake.lock found');
    return null;
  }

  await writeLocalFile(packageFileName, newPackageFileContent);

  let cmd = `nix --extra-experimental-features 'nix-command flakes' `;

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
      .filter(isNonEmptyStringAndNotWhitespace)
      .map((depName) => quote(depName))
      .join(' ');
    cmd += `flake update ${inputs}`;
  }
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    extraEnv: {
      ...getGitEnvironmentVariables(),
      NIX_CACHE_HOME: await ensureCacheDir('nix'),
    },
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
