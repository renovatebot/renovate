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
  return versions.join(' ');
}

function npm2cargo(input) {
  // Note: this doesn't remove the ^
  // FIXME: If there are spaces between version and an operator like:
  // ">= 1.1.0 < 2.0.0" then this function incorrectly will transform this into:
  // ">=,1.1.0,<,2.0.0"
  // TODO: Add tests addressing this
  return input
    .split(' ')
    .map(str => str.trim())
    .join(', ');
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

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  if (rangeStrategy === 'pin' || isSingleVersion(currentValue)) {
    let res = '=';
    if (currentValue.startsWith('= ')) {
      res += ' ';
    }
    res += toVersion;
    return res;
  }
  const newSemver = semver.getNewValue(
    cargo2npm(currentValue),
    rangeStrategy,
    fromVersion,
    toVersion
  );
  let newCargo = npm2cargo(newSemver);
  // Try to reverse any caret we added
  if (newCargo.startsWith('^') && !currentValue.startsWith('^')) {
    newCargo = newCargo.substring(1);
  }
  return newCargo;
}

module.exports = {
  ...semver,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  isSingleVersion,
  cargo2npm,
  getNewValue,
};
