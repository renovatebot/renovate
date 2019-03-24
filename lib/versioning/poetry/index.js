const npm = require('../npm');

function notEmpty(s) {
  return s !== '';
}

// This function works like cargo2npm, but it doesn't
// add a '^', because poetry treats versions without operators as
// exact versions.
function poetry2npm(input) {
  const versions = input
    .split(',')
    .map(str => str.trim())
    .filter(notEmpty);
  return versions.join(' ');
}

// NOTE: This function is copied from cargo versionsing code.
// Poetry uses commas (like in cargo) instead of spaces (like in npm)
// for AND operation.
function npm2poetry(input) {
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
  npm.isLessThanRange(version, poetry2npm(range));

const isValid = input => npm.isValid(poetry2npm(input));

const isVersion = input => npm.isVersion(input);

const matches = (version, range) => npm.matches(version, poetry2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  npm.maxSatisfyingVersion(versions, poetry2npm(range));

const minSatisfyingVersion = (versions, range) =>
  npm.minSatisfyingVersion(versions, poetry2npm(range));

const isSingleVersion = constraint =>
  (constraint.trim().startsWith('=') &&
    isVersion(
      constraint
        .trim()
        .substring(1)
        .trim()
    )) ||
  isVersion(constraint.trim());

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  const newSemver = npm.getNewValue(
    poetry2npm(currentValue),
    rangeStrategy,
    fromVersion,
    toVersion
  );
  const newPoetry = npm2poetry(newSemver);
  return newPoetry;
}

module.exports = {
  ...npm,
  getNewValue,
  isLessThanRange,
  isSingleVersion,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
};
