/* istanbul ignore file */

const { tokenize, compare, TYPE_NUMBER, TYPE_QUALIFIER } = require('./compare');

const isVersion = version => {
  if (!version) return false;
  if (!version.length) return false;
  if (!/^v?\d[a-z0-9.-]*$/i.test(version)) return false;
  const tokens = tokenize(version);
  const majorToken = tokens[0];
  return !!majorToken && majorToken.type === TYPE_NUMBER;
};

const equals = (a, b) => compare(a, b) === 0;

const getMajor = version => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const majorToken = tokens[0];
    return majorToken.val;
  }
  return null;
};

const getMinor = version => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const minorToken = tokens[1];
    if (minorToken && minorToken.type === TYPE_NUMBER) {
      return minorToken.val;
    }
    return 0;
  }
  return null;
};

const getPatch = version => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const minorToken = tokens[1];
    const patchToken = tokens[2];
    if (
      patchToken &&
      minorToken.type === TYPE_NUMBER &&
      patchToken.type === TYPE_NUMBER
    ) {
      return patchToken.val;
    }
    return 0;
  }
  return null;
};

const isGreaterThan = (a, b) => compare(a, b) === 1;

const isStable = version => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const qualToken = tokens.find(token => token.type === TYPE_QUALIFIER);
    if (qualToken) {
      const val = qualToken.val;
      if (val === 'final') {
        return true;
      }
      if (val === 'ga') {
        return true;
      }
      if (val === 'release') {
        return true;
      }
      if (val === 'sp') {
        return true;
      }
      // istanbul ignore next
      return false;
    }
    return true;
  }
  return null;
};

const maxSatisfyingVersion = (versions, range) =>
  versions.find(version => equals(version, range));

const getNewValue = (currentValue, rangeStrategy, fromVersion, toVersion) =>
  toVersion;

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion: isVersion,
  isStable,
  isValid: isVersion,
  isVersion,
  matches: equals,
  maxSatisfyingVersion,
  minSatisfyingVersion: maxSatisfyingVersion,
  getNewValue,
  sortVersions: compare,
};
