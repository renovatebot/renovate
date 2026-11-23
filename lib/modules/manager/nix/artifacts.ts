import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { quote } from 'shlex';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { getEnv } from '../../../util/env.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { regEx } from '../../../util/regex.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';

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

  let cmd = `nix --extra-experimental-features 'nix-command flakes' `;

  const token = findGithubToken(
    hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }),
  );

  // Not argv: /proc/<pid>/cmdline is world-readable. In nix config whitespace
  // truncates a value and `#` opens a comment, so refuse rather than mangle.
  const extraEnv: ExtraEnv = {};
  if (token) {
    if (regEx(/[\s#]/).test(token)) {
      logger.warn(
        'GitHub token is not expressible in NIX_CONFIG, not passing it to nix',
      );
    } else {
      // Ours last: for a repeated host nix keeps the first value, so theirs wins.
      extraEnv.NIX_CONFIG = [
        getEnv().NIX_CONFIG,
        `extra-access-tokens = github.com=${token}`,
      ]
        .filter(isNonEmptyStringAndNotWhitespace)
        .join('\n');
    }
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
    // extraEnv forwards it into the Docker sidecar but is only the lowest
    // precedence layer; env forces it past an ambient NIX_CONFIG.
    extraEnv,
    env: extraEnv,
    toolConstraints: [
      {
        toolName: 'nix',
        constraint: await resolveToolConstraint(config, 'nix'),
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
          fileName: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
