const {
  eq,
  valid,
  gt,
  satisfies,
  maxSatisfying,
  minSatisfying,
} = require('@snyk/ruby-semver');
const { parse: parseVersion } = require('./version');
const { parse: parseRange, ltr } = require('./range');
const { isSingleOperator, isValidOperator } = require('./operator');
const { pin, bump, replace } = require('./strategies');

const equals = (left, right) => eq(left, right);

const getMajor = version => parseVersion(version).major;
const getMinor = version => parseVersion(version).minor;
const getPatch = version => parseVersion(version).patch;

const isVersion = version => !!valid(version);
const isGreaterThan = (left, right) => gt(left, right);
const isLessThanRange = (version, range) => ltr(version, range);

const isSingleVersion = range => {
  const { version, operator } = parseRange(range);

  return operator
    ? isVersion(version) && isSingleOperator(operator)
    : isVersion(version);
};

const isStable = version =>
  parseVersion(version).prerelease ? false : isVersion(version);

const isValid = input =>
  input
    .split(',')
    .map(piece => piece.trim())
    .every(range => {
      const { version, operator } = parseRange(range);

      return operator
        ? isVersion(version) && isValidOperator(operator)
        : isVersion(version);
    });

const matches = (version, range) => satisfies(version, range);
const maxSatisfyingVersion = (versions, range) =>
  maxSatisfying(versions, range);
const minSatisfyingVersion = (versions, range) =>
  minSatisfying(versions, range);

const getNewValue = (currentValue, rangeStrategy, fromVersion, toVersion) => {
  switch (rangeStrategy) {
    case 'pin':
      return pin({ to: toVersion });
    case 'bump':
      return bump({ range: currentValue, to: toVersion });
    case 'replace':
      return replace({ range: currentValue, to: toVersion });
    // istanbul ignore next
    default:
      logger.warn(`Unsupported strategy ${rangeStrategy}`);
      return null;
  }
};

const sortVersions = (left, right) => gt(left, right);

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
