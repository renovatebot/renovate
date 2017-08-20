const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');

module.exports = {
  generateLockFile,
  getLockFile,
  maintainLockFile,
};

async function generateLockFile(tmpDir, newPackageJson, npmrcContent, logger) {
  logger.debug('Generating new package-lock.json file');
  let packageLock;
  let result = {};
  try {
    await fs.outputFile(path.join(tmpDir, 'package.json'), newPackageJson);
    if (npmrcContent) {
      await fs.outputFile(path.join(tmpDir, '.npmrc'), npmrcContent);
    }
    await fs.remove(path.join(tmpDir, 'package-lock.json'));
    logger.debug(
      `Spawning npm install to generate ${tmpDir}/package-lock.json`
    );
    result = cp.spawnSync('npm', ['install', '--ignore-scripts'], {
      cwd: tmpDir,
      shell: true,
      env: { ...process.env, ...{ NODE_ENV: 'dev' } },
    });
    logger.debug(
      { stdout: String(result.stdout), stderr: String(result.stderr) },
      'npm install complete'
    );
    packageLock = fs.readFileSync(path.join(tmpDir, 'package-lock.json'));
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        packageJson: JSON.parse(newPackageJson),
        npmrc: npmrcContent,
        stdout: String(result.stdout),
        stderr: String(result.stderr),
      },
      'Error generating package-lock.json'
    );
    throw Error('Error generating lock file');
  }
  return packageLock;
}

async function getLockFile(
  tmpDir,
  packageFile,
  packageContent,
  api,
  npmVersion,
  logger
) {
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
    tmpDir,
    packageContent,
    npmrcContent,
    logger
  );
  // Return file object
  return {
    name: packageLockFileName,
    contents: newPackageLockContent,
  };
}

async function maintainLockFile(inputConfig) {
  const logger = inputConfig.logger;
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
    path.join(inputConfig.tmpDir.name, path.dirname(inputConfig.packageFile)),
    inputConfig.packageFile,
    packageContent,
    inputConfig.api,
    inputConfig.versions.npm,
    logger
  );
  logger.trace(`newPackageLock:\n${newPackageLock.contents}`);
  if (existingPackageLock.toString() === newPackageLock.contents.toString()) {
    logger.debug('npm lock file does not need updating');
    return null;
  }
  logger.debug('npm lock needs updating');
  return newPackageLock;
}
