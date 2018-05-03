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
  const yarnWorkspaces = packageJson.workspaces;

  const lockFiles = {
    yarnLock: 'yarn.lock',
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
    shrinkwrapYaml: 'shrinkwrap.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles)) {
    const filePath = upath.join(path.dirname(packageFile), val);
    if (await platform.getFile(filePath)) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }

  let npmrc = await platform.getFile(
    upath.join(path.dirname(packageFile), '.npmrc')
  );
  if (!npmrc) {
    npmrc = undefined;
  }

  let lernaPackages;
  let lernaClient;
  const lernaJson = JSON.parse(
    await platform.getFile(upath.join(path.dirname(packageFile), 'lerna.json'))
  );
  if (lernaJson) {
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
      } catch (err) {
        logger.warn(
          { packageFile, depType, err, message: err.message },
          'Error parsing package.json'
        );
      }
    }
  }
  if (!deps.length) {
    return null;
  }
  return {
    deps,
    packageJsonName,
    packageJsonVersion,
    ...lockFiles,
    npmrc,
    yarnWorkspaces,
    lernaPackages,
    lernaClient,
  };
}

function matchesAnyPattern(val, patterns) {
  return patterns.some(pattern => minimatch(val, pattern));
}

async function postExtract(packageFiles) {
  logger.debug('postExtractDependencies');
  for (const packageFile of packageFiles) {
    const basePath = path.dirname(packageFile.packageFile);
    if (packageFile.yarnWorkspaces) {
      logger.debug(
        { packageFile: packageFile.packageFile },
        'Found yarnWorkspaces'
      );
      logger.debug('Yarn workspaces base path: ' + basePath);
      const subPackagePatterns = packageFile.yarnWorkspaces.map(pattern =>
        upath.join(basePath, pattern)
      );
      logger.debug({ subPackagePatterns }, 'Updated yarn workspaces values');
      const subPackages = packageFiles.filter(p =>
        matchesAnyPattern(path.dirname(p.packageFile), subPackagePatterns)
      );
      logger.debug({ subPackages }, 'subPackages');
      const subPackageNames = subPackages
        .map(p => p.packageJsonName)
        .filter(Boolean);
      for (const subPackage of subPackages) {
        subPackage.monorepoPackages = subPackageNames.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.workspaceDir = basePath;
      }
    } else if (packageFile.lernaPackages) {
      logger.debug(
        { packageFile: packageFile.packageFile },
        'Found lerna packages'
      );
      logger.debug('lerna base path: ' + basePath);
      const subPackagePatterns = packageFile.lernaPackages.map(pattern =>
        upath.join(basePath, pattern)
      );
      logger.debug({ subPackagePatterns }, 'Updated lerna packages values');
      const subPackages = packageFiles.filter(p =>
        matchesAnyPattern(path.dirname(p.packageFile), subPackagePatterns)
      );
      const subPackageNames = subPackages
        .map(p => p.packageJsonName)
        .filter(Boolean);
      for (const subPackage of subPackages) {
        subPackage.monorepoPackages = subPackageNames.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.lernaDir = basePath;
        if (
          packageFile.lernaClient === 'npm' &&
          packageFile.packageLock &&
          !subPackage.packageLock
        ) {
          logger.debug('Detected hoisted package-lock.json');
          subPackage.packageLock = packageFile.packageLock;
        }
      }
    }
  }
  const lockFileCache = {};
  for (const packageFile of packageFiles) {
    const {
      yarnLock,
      workspaceDir,
      packageLock,
      shrinkwrapJson,
      shrinkwrapYaml,
    } = packageFile;
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
    } else if (workspaceDir) {
      logger.debug('Found workspacesDir');
      const lockFile = upath.join(workspaceDir, 'yarn.lock');
      if (!lockFileCache[lockFile]) {
        logger.debug('Retrieving/parsing ' + lockFile);
        lockFileCache[lockFile] = await getYarnLock(lockFile);
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion =
          lockFileCache[lockFile][`${dep.depName}@${dep.currentVersion}`];
      }
    } else if (shrinkwrapJson || packageLock) {
      const filePath = shrinkwrapJson || packageLock;
      logger.debug({ filePath }, 'npm lockfile');
      if (!lockFileCache[filePath]) {
        logger.debug('Retrieving/parsing ' + filePath);
        lockFileCache[filePath] = await getNpmLock(filePath);
      }
      for (const dep of packageFile.deps) {
        dep.lockedVersion = lockFileCache[filePath][dep.depName];
      }
    } else if (shrinkwrapYaml) {
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
