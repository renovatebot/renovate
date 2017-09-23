const fs = require('fs-extra');
const path = require('path');
const getInstalledPath = require('get-installed-path');
const { exec } = require('child-process-promise');

module.exports = {
  generateLockFile,
};

async function generateLockFile(tmpDir, logger) {
  logger.debug(`Spawning yarn install to create ${tmpDir}/yarn.lock`);
  let lockFile = null;
  let stdout;
  let stderr;
  try {
    const startTime = process.hrtime();
    let cmd;
    try {
      // See if renovate is installed locally
      const installedPath = path.join(
        await getInstalledPath('yarn', {
          local: true,
        }),
        'bin/yarn.js'
      );
      cmd = `node ${installedPath}`;
    } catch (localerr) {
      logger.debug('No locally installed yarn found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = path.join(
          await getInstalledPath('yarn', {
            local: true,
            cwd: renovateLocation,
          }),
          'bin/yarn.js'
        );
        cmd = `node ${installedPath}`;
      } catch (nestederr) {
        logger.debug('Could not find globally nested yarn');
        // look for global yarn
        try {
          const installedPath = path.join(
            await getInstalledPath('yarn'),
            'bin/yarn.js'
          );
          cmd = `node ${installedPath}`;
        } catch (globalerr) {
          logger.warn('Could not find globally installed yarn');
          cmd = 'yarn';
        }
      }
    }
    logger.debug(`Using yarn: ${cmd}`);
    cmd += ' install';
    cmd += ' --ignore-scripts';
    cmd += ' --ignore-engines';
    // TODO: Switch to native util.promisify once using only node 8
    ({ stdout, stderr } = await exec(cmd, {
      cwd: tmpDir,
      shell: true,
      env: { NODE_ENV: 'dev', PATH: process.env.PATH },
    }));
    logger.debug(`yarn stdout:\n${stdout}`);
    logger.debug(`yarn stderr:\n${stderr}`);
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
        stdout,
        stderr,
      },
      'yarn install error'
    );
  }
  return lockFile;
}
