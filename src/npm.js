const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

var config = {};

module.exports = {
  init: function(verbose = false) {
    config.verbose = verbose;
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
        if (!semver.valid(currentVersion)) {
          if (config.verbose) {
            console.log(`${depName}: Skipping invalid version ${currentVersion}`);
          }
          return;
        }
        allDependencyChecks.push(getDependencyUpgrades(depName, currentVersion)
        .then(res => {
          if (Object.keys(res).length > 0) {
            console.log(`${depName} upgrades: ${JSON.stringify(res)}`);
            Object.keys(res).forEach(function(majorVersion) {
              allDependencyUpgrades.push({
                depType: depType,
                depName: depName,
                currentVersion: currentVersion,
                nextVersion: res[majorVersion],
              });
            });

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
    let allUpgrades = {};
    if (!res.body['versions']) {
      console.log(depName + ' versions is null');
    }
    Object.keys(res.body['versions']).forEach(function(version) {
      if (stable.is(currentVersion) && !stable.is(version)) {
        // Ignore unstable versions, unless the current version is unstable
        return;
      }
      if (semver.gt(version, currentVersion)) {
        // Group by major versions
        var thisMajor = semver.major(version);
        if (!allUpgrades[thisMajor] || semver.gt(version, allUpgrades[thisMajor])) {
          allUpgrades[thisMajor] = version;
        }
      }
    });
    return allUpgrades;
  });
}
