const yarnLockParser = require('@yarnpkg/lockfile');
const minimatch = require('minimatch');
const path = require('path');
const upath = require('upath');

module.exports = {
  extractDependencies,
  postExtract,
  getYarnLock,
  getNpmLock,
};

async function extractDependencies(content, packageFile) {
  const deps = [];
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ packageFile }, 'Invalid JSON');
    return null;
  }
  const packageJsonName = packageJson.name;
  const packageJsonVersion = packageJson.version;
  const yarnWorkspacesPackages = packageJson.workspaces;

  const lockFiles = {
    yarnLock: 'yarn.lock',
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
    pnpmShrinkwrap: 'shrinkwrap.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles)) {
    const filePath = upath.join(path.dirname(packageFile), val);
    if (await platform.getFile(filePath)) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  lockFiles.npmLock = lockFiles.packageLock || lockFiles.shrinkwrapJson;
  delete lockFiles.packageLock;
  delete lockFiles.shrinkwrapJson;

  let npmrc = await platform.getFile(
    upath.join(path.dirname(packageFile), '.npmrc')
  );
  if (!npmrc) {
    npmrc = undefined;
  }

  let lernaDir;
  let lernaPackages;
  let lernaClient;
  const lernaJson = JSON.parse(
    await platform.getFile(upath.join(path.dirname(packageFile), 'lerna.json'))
  );
  if (lernaJson) {
    lernaDir = path.dirname(packageFile);
    lernaPackages = lernaJson.packages;
    lernaClient = lernaJson.npmClient;
  }

  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
    'engines',
  ];
  for (const depType of depTypes) {
    if (packageJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(packageJson[depType])) {
          deps.push({
            depName,
            depType,
            currentVersion: version.trim().replace(/^=/, ''),
          });
        }
      } catch (err) /* istanbul ignore next */ {
        logger.info(
          { packageFile, depType, err, message: err.message },
          'Error parsing package.json'
        );
        return null;
      }
    }
  }
  if (!(deps.length || lernaDir || yarnWorkspacesPackages)) {
    return null;
  }
  return {
    deps,
    packageJsonName,
    packageJsonVersion,
    npmrc,
    ...lockFiles,
    lernaDir,
    lernaClient,
    lernaPackages,
    yarnWorkspacesPackages,
  };
}

function matchesAnyPattern(val, patterns) {
  return patterns.some(pattern => minimatch(val, pattern));
}

async function postExtract(packageFiles) {
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const {
      packageFile,
      npmLock,
      yarnLock,
      lernaDir,
      lernaClient,
      lernaPackages,
      yarnWorkspacesPackages,
    } = p;
    const basePath = path.dirname(packageFile);
    let packages;
    if (lernaDir && !(lernaClient === 'yarn' && yarnWorkspacesPackages)) {
      packages = lernaPackages;
    } else {
      packages = yarnWorkspacesPackages;
    }
    if (packages && packages.length) {
      logger.debug(
        { packageFile },
        'Found monorepo packages with base path ' + basePath
      );
      const subPackagePatterns = packages.map(pattern =>
        upath.join(basePath, pattern)
      );
      const subPackages = packageFiles.filter(sp =>
        matchesAnyPattern(path.dirname(sp.packageFile), subPackagePatterns)
      );
      const subPackageNames = subPackages
        .map(sp => sp.packageJsonName)
        .filter(Boolean);
      for (const subPackage of subPackages) {
        subPackage.monorepoPackages = subPackageNames.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.lernaDir = lernaDir;
        subPackage.yarnLock = subPackage.yarnLock || yarnLock;
        subPackage.npmLock = subPackage.npmLock || npmLock;
      }
    }
  }
  const lockFileCache = {};
  logger.debug('Finding locked versions');
  for (const packageFile of packageFiles) {
    const { yarnLock, npmLock, pnpmShrinkwrap } = packageFile;
    if (yarnLock) {
      logger.debug('Found yarnLock');
      if (!lockFileCache[yarnLock]) {
        logger.debug('Retrieving/parsing ' + yarnLock);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[yarnLock][`${dep.depName}@${dep.currentVersion}`];
      }
    } else if (npmLock) {
      logger.debug({ npmLock }, 'npm lockfile');
      if (!lockFileCache[npmLock]) {
        logger.debug('Retrieving/parsing ' + npmLock);
        lockFileCache[npmLock] = await getNpmLock(npmLock);
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion = lockFileCache[npmLock][dep.depName];
      }
    } else if (pnpmShrinkwrap) {
      logger.info('TODO: implement shrinkwrap.yaml parsing of lockVersion');
    }
  }
}

async function getYarnLock(filePath) {
  const yarnLockRaw = await platform.getFile(filePath);
  try {
    const yarnLockParsed = yarnLockParser.parse(yarnLockRaw);
    if (yarnLockParsed.type !== 'success') {
      logger.info(
        { filePath, parseType: yarnLockParsed.type },
        'Error parsing yarn.lock - not success'
      );
      return null;
    }
    const lockFile = {};
    for (const [entry, val] of Object.entries(yarnLockParsed.object)) {
      logger.trace({ entry, version: val.version });
      lockFile[entry] = val.version;
    }
    return lockFile;
  } catch (err) {
    logger.info(
      { filePath, err, message: err.message },
      'Warning: Exception parsing yarn.lock'
    );
    return {};
  }
}

async function getNpmLock(filePath) {
  const lockRaw = await platform.getFile(filePath);
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockFile = {};
    for (const [entry, val] of Object.entries(lockParsed.dependencies)) {
      logger.trace({ entry, version: val.version });
      lockFile[entry] = val.version;
    }
    return lockFile;
  } catch (err) {
    logger.info(
      { filePath, err, message: err.message },
      'Warning: Exception parsing npm lock filek'
    );
    return {};
  }
}
