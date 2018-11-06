// helper functions to ease create other versioning schemas with little code
// especially if those schemas do not support ranges
exports.create = ({ parse, compare }) => {
  let schema = {};
  if (parse) {
    schema = { ...schema, ...exports.parser(parse) };
  }
  if (compare) {
    schema = { ...schema, ...exports.comparer(compare) };
  }
  return schema;
};

// since this file was meant for no range support, a range = version
// parse should return null if version not valid
// parse should return an object with property release, an array of version sections major.minor.patch
exports.parser = parse => {
  function isValid(version) {
    if (!version) {
      return null;
    }
    const parsed = parse(version);
    return parsed ? version : null;
  }
  function getSection(version, index) {
    const parsed = parse(version);
    return parsed && parsed.release.length > index
      ? parsed.release[index]
      : null;
  }
  function getMajor(version) {
    return getSection(version, 0);
  }
  function getMinor(version) {
    return getSection(version, 1);
  }
  function getPatch(version) {
    return getSection(version, 2);
  }

  return {
    // validation
    isCompatible: isValid,
    isSingleVersion: isValid,
    isStable: isValid,
    isValid,
    isVersion: isValid,
    // digestion of version
    getMajor,
    getMinor,
    getPatch,
  };
};

// this is the main reason this file was created
// most operations below could be derived from a compare function
exports.comparer = compare => {
  function equals(version, other) {
    return compare(version, other) === 0;
  }

  function isGreaterThan(version, other) {
    return compare(version, other) > 0;
  }
  function isLessThanRange(version, range) {
    return compare(version, range) < 0;
  }

  // we don't not have ranges, so versions has to be equal
  function maxSatisfyingVersion(versions, range) {
    return versions.find(v => equals(v, range)) || null;
  }
  function minSatisfyingVersion(versions, range) {
    return versions.find(v => equals(v, range)) || null;
  }
  function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
    return toVersion;
  }
  function sortVersions(version, other) {
    return compare(version, other);
  }

  return {
    equals,
    isGreaterThan,
    isLessThanRange,
    matches: equals,
    maxSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
    sortVersions,
  };
};
