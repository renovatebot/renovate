const npm = require('../npm');

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  const res = npm.getNewValue(
    currentValue,
    rangeStrategy,
    fromVersion,
    toVersion
  );
  if (npm.isVersion(res)) {
    // normalize out any 'v' prefix
    return npm.isVersion(res);
  }
  return res;
}

module.exports = {
  ...npm,
  getNewValue,
};
