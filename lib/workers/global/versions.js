const cp = require('child_process');
const tmp = require('tmp');
const root = require('root-require');

module.exports = {
  detectVersions,
};

function detectVersions(config) {
  config.logger.debug('Detecting versions');
  const versions = {};
  try {
    versions.renovate = root('package.json').version;
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    let result;
    result = cp.spawnSync('npm', ['--version'], {
      cwd: tmpDir.name,
      shell: true,
    });
    versions.npm = result.stdout.toString().split('\n')[0];
    result = cp.spawnSync('yarn', ['--version'], {
      cwd: tmpDir.name,
      shell: true,
    });
    versions.yarn = result.stdout.toString().split('\n')[0];
  } catch (err) {
    config.logger.error('Error detecting versions');
    config.logger.debug(JSON.stringify(err));
  }
  config.logger.debug({ versions }, 'Detected versions');
  config.logger.debug(`Versions: ${JSON.stringify(versions)}`);
  return versions;
}
