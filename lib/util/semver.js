const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const { is: isStable } = stable;
const isUnstable = input => !isStable(input);

const { parseRange, parse: parseVersion } = semverUtils;

const stringifyRange = range => {
  let res = semverUtils.stringifyRange(range);
  res = res.replace(/\.x\.0/g, '.x');
  return res;
};

const {
  compare: semverSort,
  gt,
  gtr,
  lt,
  ltr,
  intersects: intersectsSemver,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  minor: getMinor,
  patch: getPatch,
  satisfies: matchesSemver,
  valid: isPinnedVersion,
} = semver;

const padRange = range => range + '.0'.repeat(3 - range.split('.').length);

const getMajor = input => {
  const version = isPinnedVersion(input) ? input : padRange(input);
  return semver.major(version);
};

const isRange = input => isValidSemver(input) && !isPinnedVersion(input);

// If this is left as an alias, inputs like "17.04.0" throw errors
const isValidSemver = input => semver.validRange(input);

const isLessThan = (version, base) =>
  isPinnedVersion(base) ? lt(version, base) : ltr(version, base);

const isGreaterThan = (version, base) =>
  isPinnedVersion(base) ? gt(version, base) : gtr(version, base);

function rangify(config, currentVersion, fromVersion, toVersion) {
  const { rangeStrategy } = config;
  if (rangeStrategy === 'pin' || isPinnedVersion(currentVersion)) {
    return toVersion;
  }
  const parsedRange = parseRange(currentVersion);
  const element = parsedRange.pop();
  const previousElement = parsedRange.pop();
  if (rangeStrategy === 'widen') {
    const newVersion = rangify(
      { ...config, rangeStrategy: 'replace' },
      currentVersion,
      fromVersion,
      toVersion
    );
    if (previousElement && previousElement.operator === '-') {
      parsedRange.push(previousElement);
      parsedRange.push(parseRange(newVersion).pop());
      return stringifyRange(parsedRange);
    }
    return `${currentVersion} || ${newVersion}`;
  }
  // console.log(range);
  // Simple range
  if (config.rangeStrategy === 'bump') {
    if (element.operator === '^') {
      return `^${toVersion}`;
    }

    if (element.operator === '~') {
      return `~${toVersion}`;
    }
    console.warn('Unsupported range type');
    return null;
  }
  if (element.operator === '^') {
    if (fromVersion && getMajor(toVersion) === getMajor(fromVersion)) {
      if (getMajor(toVersion) === 0) {
        if (getMinor(toVersion) === 0) {
          return `^${toVersion}`;
        }
        return `^${getMajor(toVersion)}.${getMinor(toVersion)}.0`;
      }
      return `^${toVersion}`;
    }
    return `^${getMajor(toVersion)}.0.0`;
  }
  if (element.operator === '~') {
    return `~${getMajor(toVersion)}.${getMinor(toVersion)}.0`;
  }
  if (element.operator === '<=') {
    return `<= ${toVersion}`;
  }
  if (element.operator === '<') {
    return `< ${semver.inc(toVersion, 'patch')}`;
  }
  if (!element.operator) {
    if (element.minor) {
      if (element.minor === 'x') {
        return `${getMajor(toVersion)}.x`;
      }
      if (element.patch === 'x') {
        return `${getMajor(toVersion)}.${getMinor(toVersion)}.x`;
      }
      return `${getMajor(toVersion)}.${getMinor(toVersion)}`;
    }
    return `${getMajor(toVersion)}`;
  }
  return toVersion;
}

module.exports = {
  getMajor,
  getMinor,
  getPatch,
  intersectsSemver,
  isGreaterThan,
  isLessThan,
  isRange,
  isStable,
  isUnstable,
  isValidSemver,
  isPinnedVersion,
  matchesSemver,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  parseRange,
  parseVersion,
  rangify,
  semverSort,
  stringifyRange,
};
