const {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isGreaterThan,
  isSingleVersion,
  isStable,
  matches: mavenMatches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
} = require('../maven/index');

const { TYPE_QUALIFIER, tokenize, isSubversion } = require('../maven/compare');

const {
  REV_TYPE_LATEST,
  REV_TYPE_SUBREV,
  parseDynamicRevision,
} = require('./parse');

function isVersion(str) {
  if (!str) {
    return false;
  }
  return isSingleVersion(str) || !!parseDynamicRevision(str);
}

function matches(a, b) {
  if (!a) return false;
  if (!b) return false;
  const dynamicRevision = parseDynamicRevision(b);
  if (!dynamicRevision) return equals(a, b);
  const { type, value } = dynamicRevision;

  if (type === REV_TYPE_LATEST) {
    if (!value) return true;
    const tokens = tokenize(a);
    if (tokens.length) {
      const token = tokens[tokens.length - 1];
      if (token.type === TYPE_QUALIFIER) {
        return token.val.toLowerCase() === value;
      }
    }
    return false;
  }

  if (type === REV_TYPE_SUBREV) {
    return isSubversion(value, a);
  }

  return mavenMatches(a, value);
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
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
