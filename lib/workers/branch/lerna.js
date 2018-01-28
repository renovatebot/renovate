const fs = require('fs-extra');
const upath = require('upath');
const { getInstalledPath } = require('get-installed-path');
const { exec } = require('child-process-promise');

module.exports = {
  generateLockFiles,
};

async function generateLockFiles(tmpDir, env) {
  logger.debug(`Spawning lerna to create lock files`);
  let stdout;
  let stderr;
  try {
    const startTime = process.hrtime();
    let npmCmd;
    let npxCmd;
    try {
      // See if renovate is installed locally
      const installedPath = upath.join(
        await getInstalledPath('npm', {
          local: true,
        }),
        'bin/npm-cli.js'
      );
      npmCmd = `node ${installedPath}`;
      npxCmd = npmCmd.replace('npm-cli', 'npx-cli');
    } catch (localerr) {
      logger.debug('No locally installed npm found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = upath.join(
          await getInstalledPath('npm', {
            local: true,
            cwd: renovateLocation,
          }),
          'bin/npm-cli.js'
        );
        npmCmd = `node ${installedPath}`;
        npxCmd = npmCmd.replace('npm-cli', 'npx-cli');
      } catch (nestederr) {
        logger.debug('Could not find globally nested npm');
        // look for global npm
        try {
          const installedPath = upath.join(
            await getInstalledPath('npm'),
            'bin/npm-cli.js'
          );
          npmCmd = `node ${installedPath}`;
          npxCmd = npmCmd.replace('npm-cli', 'npx-cli');
        } catch (globalerr) {
          logger.warn('Could not find globally installed npm');
          npmCmd = 'npm';
          npxCmd = 'npx';
        }
      }
    }
    logger.debug(`Using npm: ${npmCmd}`);
    let lernaVersion = 'latest';
    try {
      lernaVersion = JSON.parse(await platform.getFile('package.json'))
        .devDependencies.lerna;
    } catch (err) {
      logger.warn('Could not detect lerna in devDependencies');
    }
    logger.debug('Using lerna version ' + lernaVersion);
    const cmd = `find . && ls -l && ${npmCmd} install --package-lock-only && ${npxCmd} lerna@${lernaVersion} bootstrap -- --package-lock-only`;
    // TODO: Switch to native util.promisify once using only node 8
    ({ stdout, stderr } = await exec(cmd, {
      cwd: tmpDir,
      shell: true,
      env,
    }));
    logger.debug(`npm stdout:\n${stdout}`);
    logger.debug(`npm stderr:\n${stderr}`);
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
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
    return { error: true, stderr: stderr || err.stderr };
  }
  return { error: false };
}
