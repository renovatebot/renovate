const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');

module.exports = {
  generateLockFile,
  getLockFile,
  maintainLockFile,
};

const yarnVersion = '0.27.5';

async function generateLockFile(
  tmpDir,
  newPackageJson,
  npmrcContent,
  yarnrcContent,
  logger
) {
  logger.debug('Generating new yarn.lock file');
  let yarnLock;
  let result = {};
  try {
    await fs.outputFile(path.join(tmpDir, 'package.json'), newPackageJson);
    if (npmrcContent) {
      await fs.outputFile(path.join(tmpDir, '.npmrc'), npmrcContent);
    }
    if (yarnrcContent) {
      const filteredYarnrc = yarnrcContent.replace(
        '--install.pure-lockfile true',
        ''
      );
      await fs.outputFile(path.join(tmpDir, '.yarnrc'), filteredYarnrc);
    }
    await fs.remove(path.join(tmpDir, 'yarn.lock'));
    logger.debug(`Spawning yarn install to create ${tmpDir}/yarn.lock`);
    // Use an embedded yarn
    const yarnBin = path.join(
      __dirname,
      '../../../bin',
      `yarn-${yarnVersion}.js`
    );
    const yarnOptions = [yarnBin, 'install', '--ignore-scripts'];
    result = cp.spawnSync('node', yarnOptions, {
      cwd: tmpDir,
      shell: true,
      env: { ...process.env, ...{ NODE_ENV: 'dev' } },
    });
    logger.debug(String(result.stdout));
    logger.debug(String(result.stderr));
    yarnLock = fs.readFileSync(path.join(tmpDir, 'yarn.lock'));
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      {
        err,
        newPackageJson: JSON.parse(newPackageJson),
        npmrcContent,
        yarnrcContent,
        stdout: String(result.stdout),
        stderr: String(result.stderr),
      },
      'Error generating yarn.lock'
    );
    throw Error('Error generating lock file');
  }
  return yarnLock;
}

async function getLockFile(tmpDir, packageFile, packageContent, api, logger) {
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
    tmpDir,
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
  const logger = inputConfig.logger;
  logger.trace({ config: inputConfig }, `maintainLockFile`);
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
    path.join(inputConfig.tmpDir.name, path.dirname(inputConfig.packageFile)),
    inputConfig.packageFile,
    packageContent,
    inputConfig.api,
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
