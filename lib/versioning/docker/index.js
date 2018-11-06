function parse(version) {
  const [prefix, suffix] = version.split('-');
  const release = prefix.split('.').map(Number);
  if (release.some(Number.isNaN)) {
    return null;
  }
  return { release, suffix: suffix || '' };
}

function compare(version1, vervion2) {
  const parsed1 = parse(version1);
  const parsed2 = parse(vervion2);
  // istanbul ignore if
  if (!(parsed1 && parsed2)) {
    return 1;
  }
  const length = Math.max(parsed1.release.length, parsed2.release.length);
  for (let i = 0; i < length; i += 1) {
    const part1 = parsed1.release[i];
    const part2 = parsed2.release[i];
    // shorter is bigger 2.1 > 2.1.1
    if (part1 === undefined) {
      return 1;
    }
    if (part2 === undefined) {
      return -1;
    }
    if (part1 !== part2) {
      return part1 - part2;
    }
  }
  // equals
  return parsed2.suffix.localeCompare(parsed1.suffix);
}

function equals(version, other) {
  return compare(version, other) === 0;
}
function getPart(version, index) {
  const parsed = parse(version);
  return parsed && parsed.release.length > index ? parsed.release[index] : null;
}
function getMajor(version) {
  return getPart(version, 0);
}
function getMinor(version) {
  return getPart(version, 1);
}
function getPatch(version) {
  return getPart(version, 2);
}
function isGreaterThan(version, other) {
  return compare(version, other) > 0;
}
function isLessThanRange(version, range) {
  return compare(version, range) < 0;
}
function isValid(version) {
  if (!version) {
    return null;
  }
  const parsed = parse(version);
  return parsed ? version : null;
}

// docker does not have ranges, so versions has to be equal
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

function isCompatible(version, range) {
  const parsed1 = parse(version);
  const parsed2 = parse(range);
  return (
    parsed1.suffix === parsed2.suffix &&
    parsed1.release.length === parsed2.release.length
  );
}

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion: isValid,
  isStable: isValid,
  isValid,
  isVersion: isValid,
  matches: equals,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
