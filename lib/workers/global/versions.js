const cp = require('child_process');
const tmp = require('tmp');
const pJson = require('root-require')('package.json');

module.exports = {
  detectVersions,
};

function detectVersions(config) {
  config.logger.debug('Detecting versions');
  const versions = {};
  try {
    versions.renovate = pJson.version;
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    let result;
    result = cp.spawnSync('npm', ['--version'], {
      cwd: tmpDir.name,
      shell: true,
    });
    const npmVersion = result.stdout.toString().split('\n')[0];
    if (npmVersion.length) {
      versions.npm = npmVersion;
    }
    result = cp.spawnSync('yarn', ['--version'], {
      cwd: tmpDir.name,
      shell: true,
    });
    const yarnVersion = result.stdout.toString().split('\n')[0];
    if (yarnVersion.length) {
      versions.yarn = yarnVersion;
    }
  } catch (err) {
    config.logger.error('Error detecting versions');
    config.logger.debug(JSON.stringify(err));
  }
  config.logger.debug({ versions }, 'Detected versions');
  config.logger.debug(`Versions: ${JSON.stringify(versions)}`);
  return versions;
}
