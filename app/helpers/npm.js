const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

let logger = null;

module.exports = {
  setLogger,
  extractDependencies,
  findUpgrades,
  isRange,
  isValidVersion,
};

function setLogger(l) {
  logger = l;
}

// Returns an array of current dependencies
function extractDependencies(packageJson) {
  // loop through dependency types
  const depTypes = ['dependencies', 'devDependencies'];
  return depTypes.reduce((allDeps, depType) => {
    // loop through each dependency within a type
    const depNames = Object.keys(packageJson[depType]) || [];
    return allDeps.concat(depNames.map(depName => ({
      depType,
      depName,
      currentVersion: packageJson[depType][depName],
    })));
  }, []);
}

function findUpgrades(dependencies) {
  const allDependencyUpgrades = [];
  // We create an array of promises so that they can be executed in parallel
  return Promise.all(dependencies.reduce((promises, dep) => promises.concat(
    getVersions(dep.depName)
    .then(versions => getUpgrades(dep.depName, dep.currentVersion, versions))
    .then((upgrades) => {
      if (upgrades.length > 0) {
        logger.verbose(`${dep.depName}: Upgrades = ${JSON.stringify(upgrades)}`);
        upgrades.forEach((upgrade) => {
          allDependencyUpgrades.push(Object.assign(dep, upgrade));
        });
      } else {
        logger.verbose(`${dep.depName}: No upgrades required`);
      }
      return Promise.resolve();
    })
    .catch((error) => {
      logger.error(`Error finding upgrades for ${dep.depName}: ${error}`);
    })), []))
  // Return the upgrade array once all Promises are complete
  .then(() => allDependencyUpgrades);
}

function getVersions(depName) {
  // supports scoped packages, e.g. @user/package
  return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, {
    json: true,
  }).then(res => res.body.versions);
}

function getUpgrades(depName, currentVersion, versions) {
  if (!isValidVersion(currentVersion)) {
    logger.verbose(`${depName} currentVersion is invalid`);
    return [];
  }
  if (!versions) {
    logger.verbose(`${depName} versions is null`);
    return [];
  }
  const allUpgrades = {};
  let workingVersion = currentVersion;
  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    // Pin ranges to their maximum satisfying version
    const maxSatisfying = semver.maxSatisfying(Object.keys(versions), currentVersion);
    allUpgrades.pin = { upgradeType: 'pin', newVersion: maxSatisfying };
    workingVersion = maxSatisfying;
  }
  // Loop through all possible versions
  Object.keys(versions).forEach((newVersion) => {
    if (stable.is(workingVersion) && !stable.is(newVersion)) {
      // Ignore unstable versions, unless the current version is unstable
      return;
    }
    if (semver.gt(newVersion, workingVersion)) {
      // Group by major versions
      const newVersionMajor = semver.major(newVersion);
      // Save this, if it's a new major version or greater than the previous greatest
      if (!allUpgrades[newVersionMajor] ||
          semver.gt(newVersion, allUpgrades[newVersionMajor].newVersion)) {
        const upgradeType = newVersionMajor > semver.major(workingVersion) ? 'major' : 'minor';
        allUpgrades[newVersionMajor] = {
          upgradeType,
          newVersion,
          newVersionMajor,
          workingVersion,
        };
      }
    }
  });
  if (allUpgrades.pin && Object.keys(allUpgrades).length > 1) {
    // Remove the pin if we found upgrades
    delete allUpgrades.pin;
  }
  // Return only the values - we don't need the keys anymore
  return Object.keys(allUpgrades).map(key => allUpgrades[key]);
}

function isRange(input) {
  // Pinned versions also return true for semver.validRange
  // We need to check first that they're not 'valid' to get only ranges
  return (semver.valid(input) === null && semver.validRange(input) !== null);
}

function isValidVersion(input) {
  return (semver.valid(input) || semver.validRange(input)) !== null;
}
