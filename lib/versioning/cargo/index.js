const semver = require('../semver');

// NOTE: Partial versions like '1.2' don't get converted to '^1.2'
// because isVersion('1.2') === false
// In cargo and in npm 1.2 is equivalent to 1.2.* so it is correct behavior.
function convertToCaret(item) {
  if (isVersion(item)) {
    return '^' + item.trim();
  }
  return item.trim();
}

function cargo2npm(input) {
  let versions = input.split(',');
  versions = versions.map(convertToCaret);
  return versions.join(' ');
}

function notEmpty(s) {
  return s !== '';
}

function npm2cargo(input) {
  // Note: this doesn't remove the ^
  const res = input
    .split(' ')
    .map(str => str.trim())
    .filter(notEmpty);
  const operators = ['^', '~', '=', '>', '<', '<=', '>='];
  for (let i = 0; i < res.length - 1; i += 1) {
    if (operators.includes(res[i])) {
      const newValue = res[i] + ' ' + res[i + 1];
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ');
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
