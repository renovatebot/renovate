const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');

module.exports = {
  generateLockFile,
};

async function generateLockFile(tmpDir, logger) {
  logger.debug('Generating new yarn.lock file');
  let lockFile = null;
  let result = {};
  try {
    logger.debug(`Spawning yarn install to create ${tmpDir}/yarn.lock`);
    // Use an embedded yarn
    const yarnBin = path.resolve('./node_modules/.bin/yarn');
    const yarnOptions = [yarnBin, 'install', '--ignore-scripts'];
    result = cp.spawnSync('node', yarnOptions, {
      cwd: tmpDir,
      shell: true,
      env: { NODE_ENV: 'dev' },
    });
    logger.debug(`yarn stdout:\n${String(result.stdout)}`);
    logger.debug(`yarn stderr:\n${String(result.stderr)}`);
    lockFile = fs.readFileSync(path.join(tmpDir, 'yarn.lock'), 'utf8');
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
