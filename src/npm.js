const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

var config = {};

module.exports = {
  init: function(verbose = false) {
    config.verbose = verbose;
  },
  getDependency(depName) {
    if (config.verbose) {
      console.log(`Looking up npm for ${depName}`);
    }
    // supports scoped packages, e.g. @user/package
    return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, { json: true });
  },
  getDependencyUpgrades(depName, currentVersion) {
    return this.getDependency(depName).then(res => {
      let allUpgrades = {};
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
  },
};
