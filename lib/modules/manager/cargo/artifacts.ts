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
import type { UpdateArtifact, UpdateArtifactsResult, Upgrade } from '../types';

async function cargoUpdate(
  manifestPath: string,
  isLockFileMaintenance: boolean,
  constraint: string | undefined
): Promise<void> {
  let cmd = `cargo update --config net.git-fetch-with-cli=true --manifest-path ${quote(
    manifestPath
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

async function cargoUpdatePrecise(
  manifestPath: string,
  updatedDeps: Upgrade<Record<string, unknown>>[],
  constraint: string | undefined
): Promise<void> {
  // Update all dependencies that have been bumped in `Cargo.toml` first.
  const cmds = [
    'cargo update --config net.git-fetch-with-cli=true' +
      ` --manifest-path ${quote(manifestPath)} --workspace`,
  ].concat(
    // Update individual dependencies to their `newVersion`. Necessary when
    // using the `update-lockfile` rangeStrategy which doesn't touch Cargo.lock.
    updatedDeps
      .filter((dep) => !!dep.lockedVersion)
      .map(
        (dep) =>
          // Hack: If a package is already at `newVersion` then skip updating.
          // This often happens when a preceding dependency also bumps this one.
          `cargo update --config net.git-fetch-with-cli=true` +
          ` --manifest-path ${quote(manifestPath)}` +
          ` --package ${dep.packageName!}@${dep.newVersion}` +
          ` --precise ${dep.newVersion}` +
          ' > /dev/null 2>&1 || ' +
          // Otherwise update the package to `newVersion`.
          `cargo update --config net.git-fetch-with-cli=true` +
          ` --manifest-path ${quote(manifestPath)}` +
          ` --package ${dep.packageName!}@${dep.lockedVersion}` +
          ` --precise ${dep.newVersion}`
      )
  );

  const execOptions: ExecOptions = {
    docker: {},
    toolConstraints: [{ toolName: 'rust', constraint }],
  };

  await exec(cmds, execOptions);
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
  if (!existingLockFileContent || !lockFileName) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);

    if (isLockFileMaintenance) {
      await cargoUpdate(packageFileName, true, config.constraints?.rust);
    } else {
      const missingDep = updatedDeps.find((dep) => !dep.lockedVersion);
      if (missingDep) {
        // If there is a dependency without a locked version then log a warning
        // and perform a regular workspace lockfile update.
        logger.warn(
          `Missing locked version for dependency \`${missingDep.depName}\``
        );
        await cargoUpdate(packageFileName, false, config.constraints?.rust);
      } else {
        // If all dependencies have locked versions then update them precisely.
        await cargoUpdatePrecise(
          packageFileName,
          updatedDeps,
          config.constraints?.rust
        );
      }
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
