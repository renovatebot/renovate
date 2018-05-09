const { exec } = require('child-process-promise');

module.exports = {
  generateLockFiles,
};

async function generateLockFiles(lernaClient, tmpDir, env) {
  logger.debug(`Spawning lerna with ${lernaClient} to create lock files`);
  let stdout;
  let stderr;
  try {
    const startTime = process.hrtime();
    let lernaVersion;
    try {
      const pJson = JSON.parse(await platform.getFile('package.json'));
      lernaVersion =
        (pJson.dependencies && pJson.dependencies.lerna) ||
        (pJson.devDependencies && pJson.devDependencies.lerna);
    } catch (err) {
      logger.warn('Could not detect lerna version in package.json');
    }
    lernaVersion = lernaVersion || 'latest';
    logger.debug('Using lerna version ' + lernaVersion);
    const params =
      lernaClient === 'npm'
        ? '--package-lock-only'
        : '--ignore-scripts --ignore-engines --ignore-platform --mutex network:31879';
    const cmd = `${lernaClient} install ${params} && npx lerna@${lernaVersion} bootstrap -- ${params}`;
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
    logger.info(
      { type: 'lerna', seconds, lernaClient, stdout, stderr },
      'Generated lockfile'
    );
  } catch (err) /* istanbul ignore next */ {
    logger.info(
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
