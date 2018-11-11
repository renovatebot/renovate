const semver = require('../semver');

function cargo2npm(input) {
  return input.replace(',', '||');
}

/* TODO: Investigate why test fails */
// const isLessThanRange = (version, range) =>
//   semver.isLessThanRange(cargo2npm(version), cargo2npm(range));

const isValid = input => semver.isValid(cargo2npm(input));

const matches = (version, range) =>
  semver.matches(cargo2npm(version), cargo2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  semver.maxSatisfyingVersion(
    versions.map(cargo2npm),
    cargo2npm(range)
  );

const minSatisfyingVersion = (versions, range) =>
  semver.minSatisfyingVersion(
    versions.map(cargo2npm),
    cargo2npm(range)
  );

module.exports = {
  ...semver,
  // isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
};
