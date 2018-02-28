const path = require('path');
const upath = require('upath');
const configParser = require('../../config');

module.exports = {
  resolvePackageFile,
};

async function resolvePackageFile(config, inputFile) {
  const packageFile = configParser.mergeChildConfig(config.npm, inputFile);
  logger.debug(
    `Resolving packageFile ${JSON.stringify(packageFile.packageFile)}`
  );
  const pFileRaw = await platform.getFile(packageFile.packageFile);
  if (!pFileRaw) {
    logger.info(
      { packageFile: packageFile.packageFile },
      'Cannot find package.json'
    );
    config.errors.push({
      depName: packageFile.packageFile,
      message: 'Cannot find package.json',
    });
    return null;
  }
  try {
    packageFile.content = JSON.parse(pFileRaw);
  } catch (err) {
    logger.info(
      { packageFile: packageFile.packageFile },
      'Cannot parse package.json'
    );
    if (config.repoIsOnboarded) {
      const error = new Error('config-validation');
      error.configFile = packageFile.packageFile;
      error.validationError = 'Cannot parse package.json';
      error.validationMessage =
        'This package.json contains invalid JSON and cannot be parsed. Please fix it, or add it to your "ignorePaths" array in your renovate config so that Renovate can continue.';
      throw error;
    }
    config.errors.push({
      depName: packageFile.packageFile,
      message:
        "Cannot parse package.json (invalid JSON). Please fix the contents or add the file/path to the `ignorePaths` array in Renovate's config",
    });
    return null;
  }
  if (!config.ignoreNpmrcFile) {
    packageFile.npmrc = await platform.getFile(
      upath.join(path.dirname(packageFile.packageFile), '.npmrc')
    );
  }
  if (packageFile.npmrc) {
    logger.info({ packageFile: packageFile.packageFile }, 'Found .npmrc');
    if (packageFile.npmrc.match(/\${NPM_TOKEN}/) && !config.global.exposeEnv) {
      logger.info('Stripping NPM_TOKEN from .npmrc');
      packageFile.npmrc = packageFile.npmrc
        .replace(/(^|\n).*?\${NPM_TOKEN}.*?(\n|$)/g, '')
        .trim();
      if (packageFile.npmrc === '') {
        logger.info('Removing empty .npmrc');
        delete packageFile.npmrc;
      }
    }
  } else {
    delete packageFile.npmrc;
  }
  packageFile.yarnrc = await platform.getFile(
    upath.join(path.dirname(packageFile.packageFile), '.yarnrc')
  );
  if (packageFile.yarnrc) {
    logger.info({ packageFile: packageFile.packageFile }, 'Found .yarnrc');
  } else {
    delete packageFile.yarnrc;
  }
  // Detect if lock files are used
  const yarnLockFileName = upath.join(
    path.dirname(packageFile.packageFile),
    'yarn.lock'
  );
  const fileList = await platform.getFileList();
  if (fileList.includes(yarnLockFileName)) {
    logger.debug({ packageFile: packageFile.packageFile }, 'Found yarn.lock');
    packageFile.yarnLock = yarnLockFileName;
  }
  const packageLockFileName = upath.join(
    path.dirname(packageFile.packageFile),
    'package-lock.json'
  );
  if (fileList.includes(packageLockFileName)) {
    logger.debug(
      { packageFile: packageFile.packageFile },
      'Found package-lock.json'
    );
    packageFile.packageLock = packageLockFileName;
  }
  const shrinkwrapFileName = upath.join(
    path.dirname(packageFile.packageFile),
    'shrinkwrap.yaml'
  );
  if (fileList.includes(shrinkwrapFileName)) {
    logger.debug(
      { packageFile: packageFile.packageFile },
      'Found shrinkwrap.yaml'
    );
    packageFile.shrinkwrapYaml = shrinkwrapFileName;
  }
  packageFile.currentPackageJsonVersion = packageFile.content.version;
  return packageFile;
}
