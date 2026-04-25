import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types.ts';
import { readLocalFile, writeLocalFile } from '../../../util/fs/index.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsResult,
  UpdateLockedConfig,
  UpdateLockedResult,
} from '../types.ts';
import {
  getConfigType,
  getLockFileName,
  getLockedVersion,
} from './lockfile.ts';
import { MiseLockFile } from './schema.ts';

/**
 * Updates mise lock files when dependencies are updated.
 * Runs `mise lock` for lock file maintenance or `mise lock <tools>` for targeted updates.
 */
export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getLockFileName(packageFileName);
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug({ lockFileName }, 'No mise lock file found');
    return null;
  }

  await writeLocalFile(packageFileName, newPackageFileContent);

  const { isLocal, env } = getConfigType(packageFileName);
  const localFlag = isLocal ? ' --local' : '';

  let cmd: string;
  if (config.isLockFileMaintenance) {
    cmd = `mise lock${localFlag}`;
  } else {
    const tools = updatedDeps
      .map(({ depName }) => depName)
      .filter(isNonEmptyStringAndNotWhitespace)
      .map((depName) => quote(depName))
      .join(' ');
    cmd = tools ? `mise lock${localFlag} ${tools}` : `mise lock${localFlag}`;
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

  try {
    await exec(cmd, execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }

    logger.debug({ lockFileName }, 'Returning updated mise lock file');
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
    // istanbul ignore if: not worth testing
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    const errorOutput = [err.stdout, err.stderr, err.message]
      .filter(Boolean)
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

/**
 * Check if a dependency is already at the target version in the lock file.
 * Returns 'already-updated' if the locked version matches newVersion,
 * 'unsupported' otherwise (letting Renovate proceed with the update).
 */
export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, newVersion, lockFile, lockFileContent } = config;
  logger.debug(
    `mise.updateLockedDependency: ${depName} -> ${newVersion} [${lockFile}]`,
  );

  if (!depName) {
    return { status: 'unsupported' };
  }

  if (!lockFileContent) {
    return { status: 'unsupported' };
  }

  try {
    const parsed = MiseLockFile.safeParse(lockFileContent);
    if (!parsed.success) {
      return { status: 'unsupported' };
    }

    const lockedVersion = getLockedVersion(parsed.data, depName);

    if (lockedVersion === newVersion) {
      return { status: 'already-updated' };
    }

    return { status: 'unsupported' };
  } catch (err) {
    logger.debug({ err }, 'mise.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
