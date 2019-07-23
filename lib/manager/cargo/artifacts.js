const upath = require('upath');
const process = require('process');
const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const { getChildProcessEnv } = require('../../util/env');
const { logger } = require('../../logger');

module.exports = {
  updateArtifacts,
};

async function updateArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug(`cargo.updateArtifacts(${packageFileName})`);
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated cargo deps - returning null');
    return null;
  }
  const lockFileName = 'Cargo.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  const localPackageFileName = upath.join(config.localDir, packageFileName);
  const localLockFileName = upath.join(config.localDir, lockFileName);
  let stdout;
  let stderr;
  try {
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    const cwd = config.localDir;
    const env = getChildProcessEnv();
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // Update dependency `${dep}` in Cargo.lock file corresponding to Cargo.toml file located
      // at ${localPackageFileName} path
      let cmd;
      // istanbul ignore if
      if (config.binarySource === 'docker') {
        logger.info('Running cargo via docker');
        cmd = `docker run --rm `;
        const volumes = [cwd];
        cmd += volumes.map(v => `-v ${v}:${v} `).join('');
        const envVars = [];
        cmd += envVars.map(e => `-e ${e} `).join('');
        cmd += `-w ${cwd} `;
        cmd += `renovate/rust cargo`;
      } else {
        logger.info('Running cargo via global cargo');
        cmd = 'cargo';
      }
      cmd += ` update --manifest-path ${localPackageFileName} --package ${dep}`;
      const startTime = process.hrtime();
      try {
        ({ stdout, stderr } = await exec(cmd, {
          cwd,
          shell: true,
          env,
        }));
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
          ({ stdout, stderr } = await exec(cmd, {
            cwd,
            shell: true,
            env,
          }));
        } else {
          throw err; // this is caught below
        }
      }
      const duration = process.hrtime(startTime);
      const seconds = Math.round(duration[0] + duration[1] / 1e9);
      logger.info(
        { seconds, type: 'Cargo.lock', stdout, stderr },
        'Updated lockfile'
      );
    }
    logger.debug('Returning updated Cargo.lock');
    const newCargoLockContent = await fs.readFile(localLockFileName, 'utf8');
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
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
}
