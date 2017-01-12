const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

let logger = null;

module.exports = {
  setLogger,
  extractAllDependencies,
  getAllUpgrades,
  isValidVersion,
};

function setLogger(l) {
  logger = l;
}

// Returns an array of current dependencies
function extractAllDependencies(packageJson) {
  // loop through dependency types
  return ['dependencies', 'devDependencies'].reduce((deps, depType) => {
    // loop through each dependency within a type
    const depNames = Object.keys(packageJson[depType]) || [];
    function getDep(depName) {
      return {
        depType,
        depName,
        currentVersion: packageJson[depType][depName],
      };
    }
    return deps.concat(depNames.map(getDep));
  }, []);
}

function getAllUpgrades(dependencies) {
  const allDependencyUpgrades = [];
  // We create an array of promises so that they can be executed in parallel
  return Promise.all(dependencies.reduce((promiseArray, dep) => {
    const depType = dep.depType;
    const depName = dep.depName;
    const currentVersion = dep.currentVersion;
    promiseArray.push(getDependencyUpgrades(depName, currentVersion)
    .then((res) => {
      if (res.length > 0) {
        logger.verbose(`${depName}: Upgrades = ${JSON.stringify(res)}`);
        res.forEach((upgrade) => {
          allDependencyUpgrades.push({
            depType,
            depName,
            currentVersion,
            upgradeType: upgrade.type,
            newVersion: upgrade.version,
            newVersionMajor: semver.major(upgrade.version),
            workingVersion: upgrade.workingVersion,
          });
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
      allUpgrades.pin = { type: 'pin', version: maxSatisfying };
      workingVersion = maxSatisfying;
    }
    const currentMajor = semver.major(workingVersion);
    Object.keys(res.body.versions).forEach((version) => {
      if (stable.is(workingVersion) && !stable.is(version)) {
        // Ignore unstable versions, unless the current version is unstable
        return;
      }
      if (semver.gt(version, workingVersion)) {
        // Group by major versions
        const thisMajor = semver.major(version);
        if (
          !allUpgrades[thisMajor] ||
            semver.gt(version, allUpgrades[thisMajor].version)
        ) {
          allUpgrades[thisMajor] = {
            type: thisMajor > currentMajor ? 'major' : 'minor',
            version,
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
  // Pinned versions also return true for semver.validRange
  // We need to check first that they're not 'valid' to get only ranges
  return !semver.valid(input) && semver.validRange(input);
}

function isValidVersion(input) {
  return semver.valid(input) || semver.validRange(input);
}
