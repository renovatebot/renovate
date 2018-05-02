const yarnLockParser = require('@yarnpkg/lockfile');
const minimatch = require('minimatch');
const path = require('path');
const upath = require('upath');

module.exports = {
  extractDependencies,
  correlateDependencies,
};

async function extractDependencies(content, fileName) {
  if (!content) {
    logger.error('No content');
    process.exit();
  }
  const deps = [];
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ fileName }, 'Invalid JSON');
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
    const filePath = upath.join(path.dirname(fileName), val);
    if (await platform.getFile(filePath)) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }

  logger.debug({ fileName, lockFiles });

  let npmrc = await platform.getFile(
    upath.join(path.dirname(fileName), '.npmrc')
  );
  if (!npmrc) {
    npmrc = undefined;
  }

  let lernaPackages;
  const lernaJson = JSON.parse(
    await platform.getFile(upath.join(path.dirname(fileName), 'lerna.json'))
  );
  if (lernaJson) {
    lernaPackages = lernaJson.packages;
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
          { fileName, depType, err, message: err.message },
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
  };
}

function matchesAnyPattern(val, patterns) {
  return patterns.some(pattern => minimatch(val, pattern));
}

async function correlateDependencies(packageFiles) {
  logger.debug('postExtractDependencies');
  for (const packageFile of packageFiles) {
    const basePath = path.dirname(packageFile.fileName);
    if (packageFile.yarnWorkspaces) {
      logger.debug({ fileName: packageFile.fileName }, 'Found yarnWorkspaces');
      logger.debug('Yarn workspaces base path: ' + basePath);
      const subPackagePatterns = packageFile.yarnWorkspaces.map(pattern =>
        upath.join(basePath, pattern)
      );
      logger.debug({ subPackagePatterns }, 'Updated yarn workspaces values');
      const subPackages = packageFiles.filter(p =>
        matchesAnyPattern(path.dirname(p.fileName), subPackagePatterns)
      );
      logger.debug({ subPackages }, 'subPackages');
      const subPackageNames = subPackages
        .map(p => p.packageJsonName)
        .filter(Boolean);
      for (const subPackage of subPackages) {
        subPackage.ignoreDeps = subPackageNames.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.yarnWorkspacesDir = basePath;
      }
    } else if (packageFile.lernaPackages) {
      logger.debug({ fileName: packageFile.fileName }, 'Found lerna packages');
      logger.debug('lerna base path: ' + basePath);
      const subPackagePatterns = packageFile.lernaPackages.map(pattern =>
        upath.join(basePath, pattern)
      );
      logger.debug({ subPackagePatterns }, 'Updated lerna packages values');
      const subPackages = packageFiles.filter(p =>
        matchesAnyPattern(path.dirname(p.fileName), subPackagePatterns)
      );
      logger.debug({ subPackages }, 'subPackages');
      const subPackageNames = subPackages
        .map(p => p.packageJsonName)
        .filter(Boolean);
      for (const subPackage of subPackages) {
        subPackage.ignoreDeps = subPackageNames.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.lernaDir = basePath;
      }
    }
  }
  const lockFileCache = {};
  let lockFile = {};
  for (const packageFile of packageFiles) {
    const { yarnLock } = packageFile;
    if (yarnLock) {
      logger.debug('Found yarnLock');
      if (!lockFileCache[yarnLock]) {
        logger.debug('Retrieving/parsing ' + yarnLock);
        lockFileCache[yarnLock] = await getYarnLock(yarnLock);
      }
      lockFile = lockFileCache[yarnLock];
    }
    for (const dep of packageFile.deps) {
      dep.lockedVersion = lockFile[`${dep.depName}@${dep.currentVersion}`];
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
