import { exec } from '../../util/exec';
import { getChildProcessEnv } from '../../util/exec/env';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { BinarySource } from '../../util/exec/common';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`cargo.updateArtifacts(${packageFileName})`);
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated cargo deps - returning null');
    return null;
  }
  const lockFileName = getSiblingFileName(packageFileName, 'Cargo.lock');
  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    const cwd = config.localDir;
    const env = getChildProcessEnv();
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // Update dependency `${dep}` in Cargo.lock file corresponding to Cargo.toml file located
      // at ${localPackageFileName} path
      let cmd: string;
      if (config.binarySource === BinarySource.Docker) {
        logger.info('Running cargo via docker');
        cmd = `docker run --rm `;
        if (config.dockerUser) {
          cmd += `--user=${config.dockerUser} `;
        }
        const volumes = [cwd];
        cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
        cmd += `-w "${cwd}" `;
        cmd += `renovate/rust cargo`;
      } else {
        logger.info('Running cargo via global cargo');
        cmd = 'cargo';
      }
      cmd += ` update --manifest-path ${packageFileName} --package ${dep}`;
      try {
        await exec(cmd, {
          cwd,
          env,
        });
      } catch (err) /* istanbul ignore next */ {
        // Two different versions of one dependency can be present in the same
        // crate, and when that happens an attempt to update it with --package ${dep}
        // key results in cargo exiting with error code `101` and an error mssage:
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
          await exec(cmd, {
            cwd,
            env,
          });
        } else {
          throw err; // this is caught below
        }
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
          name: lockFileName,
          contents: newCargoLockContent,
        },
      },
    ];
  } catch (err) {
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
