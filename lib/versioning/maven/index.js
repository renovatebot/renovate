const {
  isVersion,
  tokenize,
  compare,
  TYPE_NUMBER,
  TYPE_QUALIFIER,
  isSingleVersion,
  autoExtendMavenRange,
  parseRange,
  EXCLUDING_POINT,
} = require('./compare');

const equals = (a, b) => compare(a, b) === 0;

function matches(a, b) {
  if (!b) return false;
  if (isSingleVersion(b)) return equals(a, b);
  const ranges = parseRange(b);
  if (!ranges) return false;
  return ranges.reduce((result, range) => {
    if (result) return result;

    const { leftType, leftValue, rightType, rightValue } = range;

    let leftResult = true;
    let rightResult = true;

    if (leftValue) {
      leftResult =
        leftType === EXCLUDING_POINT
          ? compare(leftValue, a) === -1
          : compare(leftValue, a) !== 1;
    }

    if (rightValue) {
      rightResult =
        rightType === EXCLUDING_POINT
          ? compare(a, rightValue) === -1
          : compare(a, rightValue) !== 1;
    }

    return leftResult && rightResult;
  }, false);
}

const getMajor = version => {
  if (isSingleVersion(version)) {
    const tokens = tokenize(version);
    const majorToken = tokens[0];
    return majorToken.val;
  }
  return null;
};

const getMinor = version => {
  if (isSingleVersion(version)) {
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
  if (isSingleVersion(version)) {
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
  if (isSingleVersion(version)) {
    const tokens = tokenize(version);
    const qualToken = tokens.find(token => token.type === TYPE_QUALIFIER);
    if (qualToken) {
      const val = qualToken.val;
      if (val === 'final') return true;
      if (val === 'ga') return true;
      if (val === 'release') return true;
      if (val === 'sp') return true;
      // istanbul ignore next
      return false;
    }
    return true;
  }
  return null;
};

const maxSatisfyingVersion = (versions, range) =>
  versions.find(version => equals(version, range));

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  return isSingleVersion(currentValue)
    ? toVersion
    : autoExtendMavenRange(currentValue, toVersion);
}

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion,
  isStable,
  isValid: isVersion,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion: maxSatisfyingVersion,
  getNewValue,
  sortVersions: compare,
};
