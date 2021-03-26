import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function cargoUpdate(
  manifestPath: string,
  packageName?: string
): Promise<void> {
  let cmd = `cargo update --manifest-path ${quote(manifestPath)}`;
  if (packageName) {
    cmd += ` --package ${quote(packageName)}`;
  }

  const execOptions: ExecOptions = {
    docker: {
      image: 'rust',
    },
  };
  try {
    await exec(cmd, execOptions);
  } catch (err) /* istanbul ignore next */ {
    // Two different versions of one dependency can be present in the same
    // crate, and when that happens an attempt to update it with --package ${dep}
    // key results in cargo exiting with error code `101` and an error message:
    // "error: There are multiple `${dep}` packages in your project".
    //
    // If exception `err` was caused by this, we execute `updateAll` function
    // instead of returning an error. `updateAll` function just executes
    // "cargo update --manifest-path ${localPackageFileName}" without the `--package` key.
    //
    // If exception `err` was not caused by this, we just rethrow it. It will be caught
    // by the outer try { } catch {} and processed normally.
    const msgStart = 'error: There are multiple';
    if (err.code === 101 && err.stderr.startsWith(msgStart)) {
      cmd = cmd.replace(/ --package.*/, '');
      await exec(cmd, execOptions);
    } else {
      throw err; // this is caught below
    }
  }
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
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // Update dependency `${dep}` in Cargo.lock file corresponding to Cargo.toml file located
      // at ${localPackageFileName} path
      await cargoUpdate(packageFileName, dep);
    }
    if (isLockFileMaintenance) {
      await cargoUpdate(packageFileName);
    }
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
