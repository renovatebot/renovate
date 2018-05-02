const minimatch = require('minimatch');
const path = require('path');
const upath = require('upath');

module.exports = {
  extractDependencies,
  postExtractDependencies,
  extractDependenciesOld,
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

function postExtractDependencies(packageFiles) {
  logger.debug('postExtractDependencies');
  const res = [];
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
    res.push(packageFile);
  }
  return res;
}

function extractDependenciesOld(packageJson, config) {
  const {
    depType,
    packageLockParsed,
    npmShrinkwrapParsed,
    yarnLockParsed,
  } = config;
  const depNames = packageJson[depType]
    ? Object.keys(packageJson[depType])
    : [];
  return depNames
    .map(depName => {
      const currentVersion = packageJson[depType][depName]
        ? `${packageJson[depType][depName]}`.trim().replace(/^=/, '')
        : undefined;
      let lockedVersion;
      try {
        const lockFile = packageLockParsed || npmShrinkwrapParsed;
        if (lockFile) {
          if (lockFile.dependencies[depName]) {
            lockedVersion = lockFile.dependencies[depName].version;
            if (lockedVersion !== currentVersion) {
              logger.debug(
                { currentVersion, lockedVersion },
                'Found locked version'
              );
            }
          } else {
            logger.debug({ currentVersion }, 'Found no locked version');
          }
        } else if (yarnLockParsed && yarnLockParsed.object) {
          const key = `${depName}@${currentVersion}`;
          const lockEntry = yarnLockParsed.object[key];
          if (lockEntry) {
            lockedVersion = lockEntry.version;
            if (lockedVersion !== currentVersion) {
              logger.debug(
                { currentVersion, lockedVersion },
                'Found locked version'
              );
            }
          } else {
            logger.debug({ currentVersion }, 'Found no locked version');
          }
        }
      } catch (err) {
        logger.debug({ currentVersion }, 'Could not find locked version');
      }
      return {
        depType,
        depName,
        currentVersion,
        lockedVersion,
      };
    })
    .filter(dep => dep.currentVersion);
}
