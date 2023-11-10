import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function cargoUpdate(
  manifestPath: string,
  isLockFileMaintenance: boolean,
  constraint: string | undefined,
): Promise<void> {
  let cmd = `cargo update --config net.git-fetch-with-cli=true --manifest-path ${quote(
    manifestPath,
  )}`;
  // If we're updating a specific crate, `cargo-update` requires `--workspace`
  // for more information, see: https://github.com/renovatebot/renovate/issues/12332
  if (!isLockFileMaintenance) {
    cmd += ` --workspace`;
  }

  const execOptions: ExecOptions = {
    extraEnv: { ...getGitEnvironmentVariables(['cargo']) },
    docker: {},
    toolConstraints: [{ toolName: 'rust', constraint }],
  };
  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`cargo.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated cargo deps - returning null');
    return null;
  }

  // For standalone package crates, the `Cargo.lock` will be in the same
  // directory as `Cargo.toml` (ie. a sibling). For cargo workspaces, it
  // will be further up.
  const lockFileName = await findLocalSiblingOrParent(
    packageFileName,
    'Cargo.lock',
  );
  const existingLockFileContent = lockFileName
    ? await readLocalFile(lockFileName)
    : null;
  if (!existingLockFileContent || !lockFileName) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    await cargoUpdate(
      packageFileName,
      isLockFileMaintenance,
      config.constraints?.rust,
    );
    logger.debug('Returning updated Cargo.lock');
    const newCargoLockContent = await readLocalFile(lockFileName);
    if (existingLockFileContent === newCargoLockContent) {
      logger.debug('Cargo.lock is unchanged');
      return null;
    }
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newCargoLockContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Cargo lock file');
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
