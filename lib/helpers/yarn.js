const logger = require('winston');
const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');
const path = require('path');

module.exports = {
  generateLockFile,
};

async function generateLockFile(newPackageJson, npmrcContent, yarnrcContent) {
  logger.debug('Generating new yarn.lock file');
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  let yarnLock;
  try {
    fs.writeFileSync(path.join(tmpDir.name, 'package.json'), newPackageJson);
    if (npmrcContent) {
      fs.writeFileSync(path.join(tmpDir.name, '.npmrc'), npmrcContent);
    }
    if (yarnrcContent) {
      fs.writeFileSync(path.join(tmpDir.name, '.yarnrc'), yarnrcContent);
    }
    cp.spawnSync('yarn', ['install'], { cwd: tmpDir.name, shell: true });
    yarnLock = fs.readFileSync(path.join(tmpDir.name, 'yarn.lock'));
  } catch (error) {
    tmpDir.removeCallback();
    throw error;
  }
  tmpDir.removeCallback();
  return yarnLock;
}
