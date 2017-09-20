const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');
const getInstalledPath = require('get-installed-path');

module.exports = {
  generateLockFile,
};

async function generateLockFile(tmpDir, logger) {
  logger.debug(`Spawning npm install to create ${tmpDir}/package-lock.json`);
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
          await getInstalledPath('npm', {
            local: true,
          }),
          'bin/npm-cli.js'
        )
      );
    } catch (localerr) {
      logger.debug('No locally installed npm found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        options.push(
          path.join(
            await getInstalledPath('npm', {
              local: true,
              cwd: renovateLocation,
            }),
            'bin/npm-cli.js'
          )
        );
      } catch (nestederr) {
        logger.debug('Could not find globally nested npm');
        // look for global npm
        try {
          options.push(
            path.join(await getInstalledPath('npm'), 'bin/npm-cli.js')
          );
        } catch (globalerr) {
          logger.warn('Could not find globally installed npm');
          cmd = 'npm';
        }
      }
    }
    logger.debug(`Using npm: ${options[0] || cmd}`);
    options.push('install');
    options.push('--ignore-scripts');
    result = cp.spawnSync(cmd, options, {
      cwd: tmpDir,
      shell: true,
      env: { NODE_ENV: 'dev', PATH: process.env.PATH },
    });
    logger.debug(`npm stdout:\n${String(result.stdout)}`);
    logger.debug(`npm stderr:\n${String(result.stderr)}`);
    const duration = process.hrtime(startTime);
    const durationSeconds = Math.round(duration[0] + duration[1] / 1e9);
    lockFile = fs.readFileSync(path.join(tmpDir, 'package-lock.json'), 'utf8');
    logger.info(
      { durationSeconds, lockFile: 'package-lock.json' },
      'Generated lockfile'
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        stdout: String(result.stdout),
        stderr: String(result.stderr),
      },
      'npm install error'
    );
  }
  return lockFile;
}
