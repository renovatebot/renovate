import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../util/git/exec.ts';
import { regEx } from '../../../util/regex.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import {
  artifactErrorResult,
  fileAddition,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';
import { extractLockFileContentVersions } from './locked-version.ts';
import { getMinPublishAgeEnv } from './minimum-release-age.ts';
import type { CargoManagerData, MinPublishAgeEnv } from './types.ts';

const gitExec = withGitEnvironment(['cargo', CrateDatasource.id]);

async function cargoUpdate(
  manifestPath: string,
  isLockFileMaintenance: boolean,
  constraint: string | undefined,
  extraEnv: Record<string, string>,
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
    docker: {},
    extraEnv,
    toolConstraints: [{ toolName: 'rust', constraint }],
  };
  await gitExec(cmd, execOptions);
}

async function cargoUpdatePrecise(
  manifestPath: string,
  updatedDeps: Upgrade[],
  constraint: string | undefined,
  extraEnv: Record<string, string>,
): Promise<void> {
  const cmds = [];

  // First update individual dependencies to their `newVersion`. Necessary when
  // using the `update-lockfile` rangeStrategy which doesn't touch Cargo.toml.
  for (const dep of updatedDeps) {
    // If the range is bumped in Cargo.toml, the old lockedVersion may no longer
    // exist in Cargo's dependency graph, so let the --workspace update at the
    // end re-resolve it instead.
    if (dep.currentValue && dep.newValue && dep.currentValue !== dep.newValue) {
      continue;
    }

    cmds.push(
      `cargo update --config net.git-fetch-with-cli=true` +
        ` --manifest-path ${quote(manifestPath)}` +
        ` --package ${quote(`${dep.packageName}@${dep.lockedVersion}`)}` +
        ` --precise ${quote(dep.newVersion!)}`,
    );
  }

  // Then update all dependencies that have been bumped in `Cargo.toml`.
  cmds.push(
    `cargo update --config net.git-fetch-with-cli=true --manifest-path ${quote(manifestPath)} --workspace`,
  );

  const execOptions: ExecOptions = {
    docker: {},
    extraEnv,
    toolConstraints: [{ toolName: 'rust', constraint }],
  };

  await gitExec(cmds, execOptions);
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact<CargoManagerData>,
): Promise<UpdateArtifactsResult[] | null> {
  return await updateArtifactsImpl(updateArtifact);
}

/**
 * Adds `notice` to the results, which hold the lock file.
 */
function withNotice(
  results: UpdateArtifactsResult[] | null,
  lockFileName: string,
  notice: string | undefined,
): UpdateArtifactsResult[] | null {
  if (!notice || !results) {
    return results;
  }
  return results.map(({ file }) => ({
    file,
    notice: { file: lockFileName, message: notice },
  }));
}

/**
 * @param inheritedMinPublishAge The minimum publish age of a failed attempt, which has already updated crates of the lock file with it.
 */
async function updateArtifactsImpl(
  {
    packageFileName,
    updatedDeps,
    newPackageFileContent,
    config,
  }: UpdateArtifact<CargoManagerData>,
  recursionLimit = 10,
  inheritedMinPublishAge?: MinPublishAgeEnv,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`cargo.updateArtifacts(${packageFileName})`);

  // For standalone package crates, the `Cargo.lock` will be in the same
  // directory as `Cargo.toml` (ie. a sibling). For cargo workspaces, it
  // will be further up.
  const lockFileName = await findLocalSiblingOrParent(
    packageFileName,
    'Cargo.lock',
  );
  let existingLockFileContent: string | null = null;
  if (lockFileName) {
    existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  }
  if (!existingLockFileContent || !lockFileName) {
    logger.debug('No Cargo.lock found');
    return null;
  }

  const { isLockFileMaintenance } = config;
  if (!isLockFileMaintenance && !updatedDeps?.length) {
    logger.debug('No more dependencies to update');
    return withNotice(
      [fileAddition(lockFileName, existingLockFileContent)],
      lockFileName,
      inheritedMinPublishAge?.notice,
    );
  }

  const rustConstraint = await resolveToolConstraint(config, 'rust');
  const minPublishAge =
    inheritedMinPublishAge ??
    (await getMinPublishAgeEnv({
      config,
      manager: 'cargo',
      packageFile: packageFileName,
      upgrades: updatedDeps,
    }));
  const { env: extraEnv, notice } = minPublishAge;

  try {
    const results = await updateLockFile({
      lockFileName,
      existingLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      run: async () => {
        logger.debug(`Updating ${lockFileName}`);

        if (isLockFileMaintenance) {
          await cargoUpdate(packageFileName, true, rustConstraint, extraEnv);
          return;
        }

        const hasNonCrateDep = updatedDeps.some(
          (dep) => dep.datasource !== CrateDatasource.id,
        );
        const crateDepWithoutLockedVersion = updatedDeps.find(
          (dep) => !dep.lockedVersion && dep.datasource === CrateDatasource.id,
        );
        // Non-crate dependencies (like git ones) do not have locked versions.
        // For crate dependencies, a locked version is expected.
        // In both situations, perform a regular workspace lockfile update.
        if (hasNonCrateDep || crateDepWithoutLockedVersion) {
          // v8 ignore else -- needs a workspace update driven only by a non-crate dep
          if (crateDepWithoutLockedVersion) {
            // Only warn when a crate dependency has no locked version
            logger.warn(
              { dependency: crateDepWithoutLockedVersion.depName },
              'Missing locked version for dependency',
            );
          }
          await cargoUpdate(packageFileName, false, rustConstraint, extraEnv);
        } else {
          // If all dependencies have locked versions then update them precisely.
          await cargoUpdatePrecise(
            packageFileName,
            updatedDeps,
            rustConstraint,
            extraEnv,
          );
        }
      },
    });
    return withNotice(results, lockFileName, notice);
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    // Sometimes `cargo update` will fail when a preceding dependency update
    // causes another dependency to update. In this case we can no longer
    // reference the dependency by its old version, so we filter it out
    // and retry recursively.
    const newCargoLockContent = await readLocalFile(lockFileName, 'utf8');
    if (
      recursionLimit > 0 &&
      newCargoLockContent &&
      regEx(/error: package ID specification/).test(err.stderr)
    ) {
      const versions = extractLockFileContentVersions(newCargoLockContent);
      const newUpdatedDeps = updatedDeps.filter(
        (dep) =>
          !coerceArray(versions?.get(dep.packageName!)).includes(
            dep.newVersion!,
          ),
      );

      // v8 ignore else -- this retry only runs when a dep was already current
      if (newUpdatedDeps.length < updatedDeps.length) {
        logger.debug(
          'Dependency already up to date - reattempting recursively',
        );
        return updateArtifactsImpl(
          {
            packageFileName,
            updatedDeps: newUpdatedDeps,
            newPackageFileContent,
            config,
          },
          recursionLimit - 1,
          minPublishAge,
        );
      }
    }

    logger.debug({ err }, 'Failed to update Cargo lock file');

    return artifactErrorResult(lockFileName, err);
  }
}
