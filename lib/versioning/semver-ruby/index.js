const rubySemver = require('@snyk/ruby-semver');
const { parse: parseVersion } = require('./version');

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
};
