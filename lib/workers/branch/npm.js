const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');
const path = require('path');

let logger = require('../../logger');

module.exports = {
  generateLockFile,
  getLockFile,
  maintainLockFile,
};

async function generateLockFile(newPackageJson, npmrcContent) {
  logger.debug('Generating new package-lock.json file');
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  let packageLock;
  try {
    fs.writeFileSync(path.join(tmpDir.name, 'package.json'), newPackageJson);
    if (npmrcContent) {
      fs.writeFileSync(path.join(tmpDir.name, '.npmrc'), npmrcContent);
    }
    logger.debug('Spawning npm install');
    const result = cp.spawnSync('npm', ['install', '--ignore-scripts'], {
      cwd: tmpDir.name,
      shell: true,
    });
    logger.debug(
      { stdout: String(result.stdout), stderr: String(result.stderr) },
      'npm install complete'
    );
    packageLock = fs.readFileSync(path.join(tmpDir.name, 'package-lock.json'));
  } catch (error) /* istanbul ignore next */ {
    try {
      tmpDir.removeCallback();
    } catch (err2) {
      logger.warn(`Failed to remove tmpDir ${tmpDir.name}`);
    }
    throw error;
  }
  try {
    tmpDir.removeCallback();
  } catch (err2) {
    logger.warn(`Failed to remove tmpDir ${tmpDir.name}`);
  }
  return packageLock;
}

async function getLockFile(
  packageFile,
  packageContent,
  api,
  npmVersion,
  parentLogger
) {
  logger = parentLogger || logger;
  // Detect if a package-lock.json file is in use
  const packageLockFileName = path.join(
    path.dirname(packageFile),
    'package-lock.json'
  );
  if (!await api.getFileContent(packageLockFileName)) {
    return null;
  }
  if (npmVersion === '') {
    throw new Error(
      'Need to generate package-lock.json but npm is not installed'
    );
  }
  // TODO: have a more forwards-compatible check
  if (npmVersion[0] !== '5') {
    throw new Error(
      `Need to generate package-lock.json but npm version is "${npmVersion}"`
    );
  }
  // Copy over custom config commitFiles
  const npmrcContent = await api.getFileContent('.npmrc');
  // Generate package-lock.json using shell command
  const newPackageLockContent = await module.exports.generateLockFile(
    packageContent,
    npmrcContent
  );
  // Return file object
  return {
    name: packageLockFileName,
    contents: newPackageLockContent,
  };
}

async function maintainLockFile(inputConfig) {
  logger = inputConfig.logger || logger;
  logger.trace({ config: inputConfig }, `maintainLockFile`);
  const packageContent = await inputConfig.api.getFileContent(
    inputConfig.packageFile
  );
  const packageLockFileName = path.join(
    path.dirname(inputConfig.packageFile),
    'package-lock.json'
  );
  logger.debug(`Checking for ${packageLockFileName}`);
  const existingPackageLock = await inputConfig.api.getFileContent(
    packageLockFileName
  );
  logger.trace(`existingPackageLock:\n${existingPackageLock}`);
  if (!existingPackageLock) {
    return null;
  }
  logger.debug('Found existing package-lock.json file');
  const newPackageLock = await module.exports.getLockFile(
    inputConfig.packageFile,
    packageContent,
    inputConfig.api
  );
  logger.trace(`newPackageLock:\n${newPackageLock.contents}`);
  if (existingPackageLock.toString() === newPackageLock.contents.toString()) {
    logger.debug('npm lock file does not need updating');
    return null;
  }
  logger.debug('npm lock needs updating');
  return newPackageLock;
}
