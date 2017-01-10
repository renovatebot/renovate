const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

var config = {};

module.exports = {
  init: function(setConfig) {
    config = setConfig;
  },
  getDependencies: function(packageContents) {
    const allDependencies = [];
    const dependencyTypes = ['dependencies', 'devDependencies'];
    dependencyTypes.forEach(function(depType) {
      Object.keys(packageContents[depType]).forEach(function(depName) {
        allDependencies.push({
          depType: depType,
          depName: depName,
          currentVersion: packageContents[depType][depName],
        });
      });
    });
    return allDependencies;
  },
  getAllDependencyUpgrades: function(packageContents) {
    const allDependencyChecks = [];
    const allDependencyUpgrades = [];
    const dependencyTypes = ['dependencies', 'devDependencies'];
    dependencyTypes.forEach(function(depType) {
      if (!packageContents[depType]) {
        return;
      }
      Object.keys(packageContents[depType]).forEach(function(depName) {
        var currentVersion = packageContents[depType][depName];
        if (!isValidVersion(currentVersion)) {
          if (config.verbose) {
            console.log(`${depName}: Skipping invalid version ${currentVersion}`);
          }
          return;
        }
        allDependencyChecks.push(getDependencyUpgrades(depName, currentVersion)
        .then(res => {
          if (res.length > 0) {
            if (config.verbose) {
              console.log(`${depName}: Upgrades = ${JSON.stringify(res)}`);
            }
            res.forEach(function(upgrade) {
              allDependencyUpgrades.push({
                depType: depType,
                depName: depName,
                currentVersion: currentVersion,
                upgradeType: upgrade.type,
                newVersion: upgrade.version,
              });
            });
          } else {
            if (config.verbose) {
              console.log(`${depName}: No upgrades required`);
            }
          }
        }));
      });
    });
    return Promise.all(allDependencyChecks).then(() => {
      return allDependencyUpgrades;
    });
  },
};

function getDependency(depName) {
  // supports scoped packages, e.g. @user/package
  return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, { json: true });
}

function getDependencyUpgrades(depName, currentVersion) {
  return getDependency(depName)
  .then(res => {
    if (!res.body['versions']) {
      console.error(depName + ' versions is null');
    }
    const allUpgrades = {};
    if (isRange(currentVersion)) {
      // Pin ranges to their maximum satisfying version
      const maxSatisfying = semver.maxSatisfying(Object.keys(res.body.versions), currentVersion);
      allUpgrades['pin'] = {
        type: 'pin',
        version: maxSatisfying,
      };
      currentVersion = maxSatisfying;
    }
    const currentMajor = semver.major(currentVersion);
    Object.keys(res.body['versions']).forEach(function(version) {
      if (stable.is(currentVersion) && !stable.is(version)) {
        // Ignore unstable versions, unless the current version is unstable
        return;
      }
      if (semver.gt(version, currentVersion)) {
        // Group by major versions
        var thisMajor = semver.major(version);
        if (!allUpgrades[thisMajor] || semver.gt(version, allUpgrades[thisMajor].version)) {
          allUpgrades[thisMajor] = {
            type: (thisMajor > currentMajor) ? 'major' : 'minor',
            version: version,
          };
        }
      }
    });
    if (allUpgrades['pin'] && Object.keys(allUpgrades).length > 1) {
      // Remove the pin
      delete allUpgrades['pin'];
    }
    // Return only the values
    return Object.keys(allUpgrades).map(key => allUpgrades[key]);
  });
}

function isRange(input) {
  // Pinned versions also return true for semver.validRange
  // We need to check first that they're not "valid" to get only ranges
  return !semver.valid(input) && semver.validRange(input);
}

function isValidVersion(input) {
  return semver.valid(input) || semver.validRange(input);
}
