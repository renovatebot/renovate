module.exports = {
  extractDependencies,
};

function extractDependencies(packageJson, config) {
  const { depType, packageLockParsed, yarnLockParsed } = config;
  const depNames = packageJson[depType]
    ? Object.keys(packageJson[depType])
    : [];
  return depNames.map(depName => {
    const currentVersion = packageJson[depType][depName]
      .trim()
      .replace(/^=/, '');
    let lockedVersion;
    try {
      logger.debug('Looking for locked version');
      if (packageLockParsed) {
        logger.debug({ currentVersion }, 'Found parsed package-lock.json');
        if (packageLockParsed.dependencies[depName]) {
          logger.debug('Found match');
          lockedVersion = packageLockParsed.dependencies[depName].version;
        } else {
          logger.debug('No match');
        }
      } else if (yarnLockParsed && yarnLockParsed.object) {
        logger.debug({ currentVersion }, 'Found parsed yarn.lock');
        const key = `${depName}@${currentVersion}`;
        const lockEntry = yarnLockParsed.object[key];
        if (lockEntry) {
          logger.debug('Found match');
          lockedVersion = lockEntry.version;
        } else {
          logger.debug('No match');
        }
      } else {
        logger.debug('No lock file found');
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
  });
}
