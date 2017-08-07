const fs = require('fs');
const cp = require('child_process');
const tmp = require('tmp');
const path = require('path');

module.exports = {
  generateLockFile,
  getLockFile,
  maintainLockFile,
};

const yarnVersion = '0.27.5';

async function generateLockFile(
  newPackageJson,
  npmrcContent,
  yarnrcContent,
  logger
) {
  logger.debug('Generating new yarn.lock file');
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  let yarnLock;
  let result = {};
  try {
    fs.writeFileSync(path.join(tmpDir.name, 'package.json'), newPackageJson);
    if (npmrcContent) {
      fs.writeFileSync(path.join(tmpDir.name, '.npmrc'), npmrcContent);
    }
    if (yarnrcContent) {
      const filteredYarnrc = yarnrcContent.replace(
        '--install.pure-lockfile true',
        ''
      );
      fs.writeFileSync(path.join(tmpDir.name, '.yarnrc'), filteredYarnrc);
    }
    logger.debug('Spawning yarn install');
    // Use an embedded yarn
    const yarnBin = path.join(
      __dirname,
      '../../../bin',
      `yarn-${yarnVersion}.js`
    );
    const yarnOptions = [yarnBin, 'install', '--ignore-scripts'];
    result = cp.spawnSync('node', yarnOptions, {
      cwd: tmpDir.name,
      shell: true,
      env: { ...process.env, ...{ NODE_ENV: 'dev' } },
    });
    logger.debug(String(result.stdout));
    logger.debug(String(result.stderr));
    yarnLock = fs.readFileSync(path.join(tmpDir.name, 'yarn.lock'));
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        newPackageJson,
        npmrcContent,
        yarnrcContent,
        stdout: result.stdout,
        stderr: result.stderr,
      },
      'Error generating yarn.lock'
    );
    try {
      tmpDir.removeCallback();
    } catch (err2) {
      logger.warn(`Failed to remove tmpDir ${tmpDir.name}`);
    }
    throw Error('Error generating lock file');
  }
  try {
    tmpDir.removeCallback();
  } catch (err2) {
    logger.warn(`Failed to remove tmpDir ${tmpDir.name}`);
  }
  return yarnLock;
}

async function getLockFile(packageFile, packageContent, api, logger) {
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
    logger
  );
  // Return file object
  return {
    name: yarnLockFileName,
    contents: newYarnLockContent,
  };
}

async function maintainLockFile(inputConfig) {
  const { api, logger } = inputConfig;
  logger.trace({ config: inputConfig }, `maintainLockFile`);
  const packageContent = await api.getFileContent(inputConfig.packageFile);
  const yarnLockFileName = path.join(
    path.dirname(inputConfig.packageFile),
    'yarn.lock'
  );
  logger.debug(`Checking for ${yarnLockFileName}`);
  let existingYarnLock = await api.getFileContent(
    yarnLockFileName,
    inputConfig.branchName
  );
  if (!existingYarnLock) {
    existingYarnLock = await api.getFileContent(yarnLockFileName);
  }
  logger.trace(`existingYarnLock:\n${existingYarnLock}`);
  if (!existingYarnLock) {
    return null;
  }
  logger.debug('Found existing yarn.lock file');
  const newYarnLock = await module.exports.getLockFile(
    inputConfig.packageFile,
    packageContent,
    api,
    logger
  );
  logger.trace(`newYarnLock:\n${newYarnLock.contents}`);
  if (existingYarnLock.toString() === newYarnLock.contents.toString()) {
    logger.debug('Yarn lock file does not need updating');
    return null;
  }
  logger.debug('Yarn lock needs updating');
  return newYarnLock;
}
