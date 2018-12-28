const semver = require('../semver');

function convertToCaret(item) {
  if (isVersion(item)) {
    return '^' + item.trim();
  }
  return item.trim();
}

// FIXME: Partial versions like '1.2' don't get converted to '^1.2'
// NOTE: This might be correct behaviour.
function cargo2npm(input) {
  let versions = input.split(',');
  versions = versions.map(convertToCaret);
  return versions.join('||');
}

const isLessThanRange = (version, range) =>
  semver.isLessThanRange(version, cargo2npm(range));

const isValid = input => semver.isValid(cargo2npm(input));

const isVersion = input => semver.isVersion(input);

const matches = (version, range) => semver.matches(version, cargo2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  semver.maxSatisfyingVersion(versions, cargo2npm(range));

const minSatisfyingVersion = (versions, range) =>
  semver.minSatisfyingVersion(versions, cargo2npm(range));

const isSingleVersion = constraint =>
  constraint.trim().startsWith('=') &&
  isVersion(
    constraint
      .trim()
      .substring(1)
      .trim()
  );

module.exports = {
  ...semver,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  isSingleVersion,
  cargo2npm,
};
