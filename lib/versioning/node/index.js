const semver = require('../semver');

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  const res = semver.getNewValue(
    currentValue,
    rangeStrategy,
    fromVersion,
    toVersion
  );
  if (semver.isVersion(res)) {
    // normalize out any 'v' prefix
    return semver.isVersion(res);
  }
  return res;
}

module.exports = {
  ...semver,
  getNewValue,
};
