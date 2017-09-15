const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');

module.exports = {
  generateLockFile,
};

async function generateLockFile(tmpDir, logger) {
  logger.debug(`Spawning npm install to create ${tmpDir}/package-lock.json`);
  let lockFile = null;
  let result = {};
  try {
    const startTime = process.hrtime();
    const npmBin = path.resolve('./node_modules/.bin/npm');
    const npmOptions = [npmBin, 'install', '--ignore-scripts'];
    result = cp.spawnSync('node', npmOptions, {
      cwd: tmpDir,
      shell: true,
      env: { NODE_ENV: 'dev' },
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
