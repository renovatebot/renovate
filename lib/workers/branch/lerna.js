const upath = require('upath');
const { getInstalledPath } = require('get-installed-path');
const { exec } = require('child-process-promise');

module.exports = {
  generateLockFiles,
};

async function generateLockFiles(manager, tmpDir, env) {
  logger.debug(`Spawning lerna to create lock files`);
  let stdout;
  let stderr;
  try {
    const startTime = process.hrtime();
    let lernaVersion = 'latest';
    try {
      lernaVersion = JSON.parse(await platform.getFile('package.json'))
        .devDependencies.lerna;
    } catch (err) {
      logger.warn('Could not detect lerna in devDependencies');
    }
    logger.debug('Using lerna version ' + lernaVersion);
    const params =
      manager === 'npm' ? '--package-lock-only' : '--ignore-scripts';
    const cmd = `${manager} install ${params} && npx lerna@${lernaVersion} bootstrap -- ${params}`;
    logger.debug({ cmd });
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
    logger.info({ seconds, manager, stdout, stderr }, 'Generated lockfile');
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        stdout,
        stderr,
      },
      'lerna bootstrap error'
    );
    return { error: true, stderr: stderr || err.stderr };
  }
  return { error: false };
}
