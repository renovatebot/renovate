import { isNonEmptyStringAndNotWhitespace, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getConfigType, getLockFileName } from './lockfile.ts';

/**
 * Updates mise lock files when dependencies are updated.
 * Runs `mise lock` for lock file maintenance or `mise lock <tools>` for targeted updates.
 */
export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getLockFileName(packageFileName);
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug({ lockFileName }, 'No mise lock file found');
    return null;
  }

  const allowlist = GlobalConfig.get('allowedUnsafeExecutions');
  if (!allowlist.includes('mise')) {
    logger.once.warn(
      '`mise lock` was requested to run, but `mise` is not permitted in the allowedUnsafeExecutions',
    );
    return null;
  }

  const { isLocal, env } = getConfigType(packageFileName);
  const localFlag = isLocal ? ' --local' : '';

  let lockCmd: string;
  if (config.isLockFileMaintenance) {
    lockCmd = `mise lock${localFlag}`;
  } else {
    const tools = updatedDeps
      .map(({ depName }) => depName)
      .filter(isNonEmptyStringAndNotWhitespace)
      .map(quote)
      .join(' ');
    lockCmd = tools
      ? `mise lock${localFlag} ${tools}`
      : `mise lock${localFlag}`;
  }

  const extraEnv: ExtraEnv = {};
  if (env) {
    extraEnv.MISE_ENV = env;
  }
  const token = findGithubToken(
    hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }),
  );
  if (token) {
    extraEnv.GITHUB_TOKEN = token;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    extraEnv,
    toolConstraints: [
      {
        toolName: 'mise',
        constraint: config.constraints?.mise,
      },
    ],
    docker: {},
  };

  const trustCmd = `mise trust ${quote(upath.basename(packageFileName))}`;

  try {
    await exec([trustCmd, lockCmd], execOptions);
    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!newLockFileContent || existingLockFileContent === newLockFileContent) {
      return null;
    }

    logger.debug({ lockFileName }, 'Returning updated mise lock file');
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if: not worth testing
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    const errorOutput = [err.stdout, err.stderr, err.message]
      .filter(isString)
      .join('\n');

    logger.warn({ err }, `Error updating ${lockFileName}`);
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: errorOutput,
        },
      },
    ];
  }
}
