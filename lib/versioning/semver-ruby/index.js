const rubySemver = require('@snyk/ruby-semver');
const { parse: parseVersion } = require('./version');
const { ltr, parse: parseRange } = require('./range');
const { isSingleOperator, isValidOperator } = require('./operator');
const { pin, bump, replace } = require('./strategies');

const getMajor = version => parseVersion(version).major;
const getMinor = version => parseVersion(version).minor;
const getPatch = version => parseVersion(version).patch;

const isVersion = version => !!rubySemver.valid(version);
const isEqual = (left, right) => rubySemver.eq(left, right);
const isGreaterThan = (left, right) => rubySemver.gt(left, right);
const isStable = version =>
  parseVersion(version).prerelease ? false : isVersion(version);

const sortVersions = (left, right) => rubySemver.gt(left, right);

const minSatisfyingVersion = (versions, range) =>
  rubySemver.minSatisfying(versions, range);
const maxSatisfyingVersion = (versions, range) =>
  rubySemver.maxSatisfying(versions, range);

const matches = (version, range) => rubySemver.satisfies(version, range);
const isLessThanRange = (version, range) => ltr(version, range);

const isSingleVersion = range => {
  const { version, operator } = parseRange(range);

  return operator
    ? isVersion(version) && isSingleOperator(operator)
    : isVersion(version);
};

const isValid = range => {
  const { version, operator } = parseRange(range);

  return operator
    ? isVersion(version) && isValidOperator(operator)
    : isVersion(version);
};

const getNewValue = (currentValue, rangeStrategy, fromVersion, toVersion) => {
  switch (rangeStrategy) {
    case 'pin':
      return pin({ to: toVersion });
    case 'bump':
      return bump({ range: currentValue, to: toVersion });
    case 'replace':
      return replace({ range: currentValue, to: toVersion });
    default:
      logger.warn(`Unsupported strategy ${rangeStrategy}`);
      return null;
  }
};

module.exports = {
  getMajor,
  getMinor,
  getPatch,
  isVersion,
  isGreaterThan,
  isCompatible: isVersion,
  isStable,
  equals: isEqual,
  sortVersions,
  minSatisfyingVersion,
  maxSatisfyingVersion,
  isValid,
  isLessThanRange,
  isSingleVersion,
  matches,
  getNewValue,
};
