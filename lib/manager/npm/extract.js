module.exports = {
  extractDependencies,
  extractDependenciesOld,
};

function extractDependencies(fileName, content) {
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
  return { deps };
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
