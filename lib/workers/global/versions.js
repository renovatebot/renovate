const cp = require('child_process');
const tmp = require('tmp');
const root = require('root-require');

module.exports = {
  detectVersions,
};

function detectVersions(config) {
  const { logger } = config;
  logger.debug('Detecting versions');
  const versions = {};
  try {
    versions.renovate = root('package.json').version;
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const result = cp.spawnSync('npm', ['--version'], {
      cwd: tmpDir.name,
      shell: true,
    });
    versions.npm = result.stdout.toString().split('\n')[0];
  } catch (err) {
    logger.error({ err }, 'Error detecting versions');
  }
  logger.debug({ versions }, 'Detected versions');
  return versions;
}
