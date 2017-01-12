const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

let logger = null;

module.exports = {
  setLogger,
  extractDependencies,
  findUpgrades,
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
  return Promise.all(dependencies.reduce((promiseArray, dep) => {
    const depName = dep.depName;
    const currentVersion = dep.currentVersion;
    promiseArray.push(getDependencyUpgrades(depName, currentVersion)
    .then((res) => {
      if (res.length > 0) {
        logger.verbose(`${depName}: Upgrades = ${JSON.stringify(res)}`);
        res.forEach((upgrade) => {
          allDependencyUpgrades.push(Object.assign(dep, upgrade));
        });
      } else {
        logger.verbose(`${depName}: No upgrades required`);
      }
      return Promise.resolve();
    }));
    return promiseArray;
  }, []))
  // Return the upgrade array once all Promises are complete
  .then(() => allDependencyUpgrades);
}

function getDependency(depName) {
  // supports scoped packages, e.g. @user/package
  return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, {
    json: true,
  });
}

function getDependencyUpgrades(depName, currentVersion) {
  if (!isValidVersion(currentVersion)) {
    return [];
  }
  return getDependency(depName).then((res) => {
    if (!res.body.versions) {
      logger.error(`${depName} versions is null`);
    }
    const allUpgrades = {};
    let workingVersion = currentVersion;
    if (isRange(currentVersion)) {
      // Pin ranges to their maximum satisfying version
      const maxSatisfying = semver.maxSatisfying(
        Object.keys(res.body.versions),
        currentVersion);
      allUpgrades.pin = { upgradeType: 'pin', newVersion: maxSatisfying };
      workingVersion = maxSatisfying;
    }
    const currentMajor = semver.major(workingVersion);
    Object.keys(res.body.versions).forEach((newVersion) => {
      if (stable.is(workingVersion) && !stable.is(newVersion)) {
        // Ignore unstable versions, unless the current version is unstable
        return;
      }
      if (semver.gt(newVersion, workingVersion)) {
        // Group by major versions
        const newVersionMajor = semver.major(newVersion);
        if (
          !allUpgrades[newVersionMajor] ||
            semver.gt(newVersion, allUpgrades[newVersionMajor].newVersion)
        ) {
          const upgradeType = newVersionMajor > currentMajor ? 'major' : 'minor';
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
      // Remove the pin
      delete allUpgrades.pin;
    }
    // Return only the values
    return Object.keys(allUpgrades).map(key => allUpgrades[key]);
  });
}

function isRange(input) {
  // Pinned `version`s also return true for semver.validRange
  // We need to check first that they're not 'valid' to get only ranges
  return !semver.valid(input) && semver.validRange(input);
}

function isValidVersion(input) {
  return semver.valid(input) || semver.validRange(input);
}
