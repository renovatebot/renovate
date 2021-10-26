import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { regEx } from '../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function cargoUpdate(
  manifestPath: string,
  isLockFileMaintenance: boolean,
): Promise<void> {
  let cmd = `cargo update --manifest-path ${quote(manifestPath)}`;
  if (isLockFileMaintenance) {
    // for lockfile maintenance, we want to upgrade /all/ crates, even
    // transitive dependencies. that's the default for `cargo update`
  } else {
    // we've updated a specific crate, the proper `cargo update` invocation
    // involves `--workspace`, see https://github.com/renovatebot/renovate/issues/12332
    cmd += ` --workspace`;
  }

  const execOptions: ExecOptions = {
    docker: {
      image: 'rust',
    },
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
    'Cargo.lock'
  );
  const existingLockFileContent = lockFileName
    ? await readLocalFile(lockFileName)
    : null;
  if (!existingLockFileContent) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    await cargoUpdate(packageFileName, isLockFileMaintenance);
    logger.debug('Returning updated Cargo.lock');
    const newCargoLockContent = await readLocalFile(lockFileName);
    if (existingLockFileContent === newCargoLockContent) {
      logger.debug('Cargo.lock is unchanged');
      return null;
    }
    return [
      {
        file: {
          name: lockFileName,
          contents: newCargoLockContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ err }, 'Failed to update Cargo lock file');
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
