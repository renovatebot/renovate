const fs = require('fs-extra');
const path = require('path');
const { getInstalledPath } = require('get-installed-path');
const { exec } = require('child-process-promise');

module.exports = {
  generateLockFile,
};

async function generateLockFile(tmpDir) {
  logger.debug(`Spawning npm install to create ${tmpDir}/package-lock.json`);
  let lockFile = null;
  let stdout;
  let stderr;
  try {
    const startTime = process.hrtime();
    let cmd;
    try {
      // See if renovate is installed locally
      const installedPath = path.join(
        await getInstalledPath('npm', {
          local: true,
        }),
        'bin/npm-cli.js'
      );
      cmd = `node ${installedPath}`;
    } catch (localerr) {
      logger.debug('No locally installed npm found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = path.join(
          await getInstalledPath('npm', {
            local: true,
            cwd: renovateLocation,
          }),
          'bin/npm-cli.js'
        );
        cmd = `node ${installedPath}`;
      } catch (nestederr) {
        logger.debug('Could not find globally nested npm');
        // look for global npm
        try {
          const installedPath = path.join(
            await getInstalledPath('npm'),
            'bin/npm-cli.js'
          );
          cmd = `node ${installedPath}`;
        } catch (globalerr) {
          logger.warn('Could not find globally installed npm');
          cmd = 'npm';
        }
      }
    }
    logger.debug(`Using npm: ${cmd}`);
    cmd = `${cmd} --version && ${cmd} install`;
    cmd += ' --ignore-scripts';
    // TODO: Switch to native util.promisify once using only node 8
    ({ stdout, stderr } = await exec(cmd, {
      cwd: tmpDir,
      shell: true,
      env: { NODE_ENV: 'dev', PATH: process.env.PATH },
    }));
    logger.debug(`npm stdout:\n${stdout}`);
    logger.debug(`npm stderr:\n${stderr}`);
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    lockFile = await fs.readFile(
      path.join(tmpDir, 'package-lock.json'),
      'utf8'
    );
    logger.info(
      { seconds, type: 'package-lock.json', stdout, stderr },
      'Generated lockfile'
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        stdout,
        stderr,
      },
      'npm install error'
    );
    return { error: true, stderr };
  }
  return { lockFile };
}
