const logger = require('../helpers/logger');
const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');
const path = require('path');

module.exports = {
  generateLockFile,
  getLockFile,
  maintainLockFile,
};

async function generateLockFile(
  newPackageJson,
  npmrcContent,
  yarnrcContent,
  cacheFolder
) {
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
    logger.debug('Spawning yarn install');
    const yarnOptions = ['install'];
    if (cacheFolder && cacheFolder.length) {
      logger.debug(`Setting yarn cache folder to ${cacheFolder}`);
      yarnOptions.push(`--cache-folder ${cacheFolder}`);
    }
    const result = cp.spawnSync('yarn', yarnOptions, {
      cwd: tmpDir.name,
      shell: true,
    });
    logger.debug(String(result.stdout));
    logger.debug(String(result.stderr));
    yarnLock = fs.readFileSync(path.join(tmpDir.name, 'yarn.lock'));
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
  return yarnLock;
}

async function getLockFile(packageFile, packageContent, api, cacheFolder) {
  // Detect if a yarn.lock file is in use
  const yarnLockFileName = path.join(path.dirname(packageFile), 'yarn.lock');
  if (!await api.getFileContent(yarnLockFileName)) {
    return null;
  }
  // Copy over custom config commitFiles
  const npmrcContent = await api.getFileContent('.npmrc');
  const yarnrcContent = await api.getFileContent('.yarnrc');
  // Generate yarn.lock using shell command
  const newYarnLockContent = await module.exports.generateLockFile(
    packageContent,
    npmrcContent,
    yarnrcContent,
    cacheFolder
  );
  // Return file object
  return {
    name: yarnLockFileName,
    contents: newYarnLockContent,
  };
}

async function maintainLockFile(inputConfig) {
  logger.debug(`maintainYarnLock(${JSON.stringify(inputConfig)})`);
  const packageContent = await inputConfig.api.getFileContent(
    inputConfig.packageFile
  );
  const yarnLockFileName = path.join(
    path.dirname(inputConfig.packageFile),
    'yarn.lock'
  );
  logger.debug(`Checking for ${yarnLockFileName}`);
  let existingYarnLock = await inputConfig.api.getFileContent(
    yarnLockFileName,
    inputConfig.branchName
  );
  if (!existingYarnLock) {
    existingYarnLock = await inputConfig.api.getFileContent(yarnLockFileName);
  }
  logger.trace(`existingYarnLock:\n${existingYarnLock}`);
  if (!existingYarnLock) {
    return null;
  }
  logger.debug('Found existing yarn.lock file');
  const newYarnLock = await module.exports.getLockFile(
    inputConfig.packageFile,
    packageContent,
    inputConfig.api,
    inputConfig.yarnCacheFolder
  );
  logger.trace(`newYarnLock:\n${newYarnLock.contents}`);
  if (existingYarnLock.toString() === newYarnLock.contents.toString()) {
    logger.debug('Yarn lock file does not need updating');
    return null;
  }
  logger.debug('Yarn lock needs updating');
  return newYarnLock;
}
