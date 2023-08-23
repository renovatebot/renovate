import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { ExecError } from '../../../util/exec/exec-error';
import type { ExecOptions } from '../../../util/exec/types';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult, Upgrade } from '../types';

async function cargoUpdate(
  manifestPath: string,
  isLockFileMaintenance: boolean,
  constraint: string | undefined
): Promise<void> {
  let cmd = `cargo update --manifest-path ${quote(manifestPath)}`;
  // If we're updating a specific crate, `cargo-update` requires `--workspace`
  // for more information, see: https://github.com/renovatebot/renovate/issues/12332
  if (!isLockFileMaintenance) {
    cmd += ` --workspace`;
  }

  const execOptions: ExecOptions = {
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
  const cmds = updatedDeps
    .filter((dep) => !!dep.lockedVersion)
    .map(
      (dep) =>
        `cargo update --manifest-path ${quote(manifestPath)}` +
        ` --package ${dep.packageName!}@${dep.lockedVersion}` +
        (dep.newVersion ? ` --precise ${dep.newVersion}` : '')
    );

  const execOptions: ExecOptions = {
    docker: {},
    toolConstraints: [{ toolName: 'rust', constraint }],
  };

  try {
    await exec(cmds, execOptions);
  } catch (err) {
    if (err instanceof ExecError) {
      const pkg = err.cmd.match(regEx(/--package ([^@]+)@/))?.at(1);
      const msg = err.stderr.match(regEx(/error: (.+)/))?.at(1);
      if (pkg && msg) {
        logger.warn(
          { err },
          `Could not update cargo package \`${pkg}\`: ${msg}`
        );
      } else if (pkg) {
        logger.warn({ err }, `Could not update cargo package \`${pkg}\`.`);
      } else {
        logger.warn({ err }, `Command failed: \`${err.cmd}\`.`);
      }
    }
    throw err;
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
  if (!existingLockFileContent || !lockFileName) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);

    if (isLockFileMaintenance) {
      await cargoUpdate(packageFileName, true, config.constraints?.rust);
    } else if (updatedDeps.find((dep) => dep.lockedVersion)) {
      // If we can identify packages by their locked version, then update them precisely
      await cargoUpdatePrecise(
        packageFileName,
        updatedDeps,
        config.constraints?.rust
      );
    } else {
      // If we can't identify packages by their locked version, then perform a full lockfile update
      await cargoUpdate(packageFileName, false, config.constraints?.rust);
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
