module.exports = {
  extractDependencies,
};

function extractDependencies(packageJson, config) {
  const {
    depType,
    packageLockParsed,
    npmShrinkwrapParsed,
    yarnLockParsed,
  } = config;
  const depNames = packageJson[depType]
    ? Object.keys(packageJson[depType])
    : [];
  const deps = depNames
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
  return { deps };
}
