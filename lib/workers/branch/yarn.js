const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');
const getInstalledPath = require('get-installed-path');

module.exports = {
  generateLockFile,
};

async function generateLockFile(tmpDir, logger) {
  logger.debug(`Spawning yarn install to create ${tmpDir}/yarn.lock`);
  let lockFile = null;
  let result = {};
  try {
    const startTime = process.hrtime();
    let cmd = 'node';
    const options = [];
    try {
      // See if renovate is installed locally
      options.push(
        path.join(
          await getInstalledPath('yarn', {
            local: true,
          }),
          'bin/yarn.js'
        )
      );
    } catch (localerr) {
      logger.debug('No locally installed yarn found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        options.push(
          path.join(
            await getInstalledPath('yarn', {
              local: true,
              cwd: renovateLocation,
            }),
            'bin/yarn.js'
          )
        );
      } catch (nestederr) {
        logger.debug('Could not find globally nested yarn');
        // look for global yarn
        try {
          options.push(
            path.join(await getInstalledPath('yarn'), 'bin/yarn.js')
          );
        } catch (globalerr) {
          logger.warn('Could not find globally installed yarn');
          cmd = 'yarn';
        }
      }
    }
    logger.debug(`Using yarn: ${options[0] || cmd}`);
    options.push('install');
    options.push('--ignore-scripts');
    result = cp.spawnSync(cmd, options, {
      cwd: tmpDir,
      shell: true,
      env: { NODE_ENV: 'dev', PATH: process.env.PATH },
    });
    logger.debug(`yarn stdout:\n${String(result.stdout)}`);
    logger.debug(`yarn stderr:\n${String(result.stderr)}`);
    const duration = process.hrtime(startTime);
    const durationSeconds = Math.round(duration[0] + duration[1] / 1e9);
    lockFile = fs.readFileSync(path.join(tmpDir, 'yarn.lock'), 'utf8');
    logger.info(
      { durationSeconds, lockFile: 'yarn.lock' },
      'Generated lockfile'
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        stdout: String(result.stdout),
        stderr: String(result.stderr),
      },
      'yarn install error'
    );
  }
  return lockFile;
}
