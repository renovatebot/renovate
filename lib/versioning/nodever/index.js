const semver = require('../semver');

// Only LTS is stable
const isStable = version =>
  semver.isStable(version) && semver.matches(version, '^6.9.0 || ^8.9.0');

module.exports = {
  ...semver,
  isStable,
};
