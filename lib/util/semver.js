const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const { is: isStable } = stable;

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
  if (rangeStrategy === 'widen') {
    const newVersion = rangify(
      { ...config, rangeStrategy: 'replace' },
      currentVersion,
      fromVersion,
      toVersion
    );
    if (element.operator && element.operator.startsWith('<')) {
      return stringifyRange(parsedRange) + ' ' + newVersion;
    }
    const previousElement = parsedRange.pop();
    if (previousElement) {
      if (previousElement.operator === '-') {
        parsedRange.push(previousElement);
        parsedRange.push(parseRange(newVersion).pop());
        return stringifyRange(parsedRange);
      }
      if (element.operator && element.operator.startsWith('>')) {
        logger.warn(`Complex ranges ending in greater than are not supported`);
        return null;
      }
    }
    return `${currentVersion} || ${newVersion}`;
  }
  // console.log(range);
  // Simple range
  if (config.rangeStrategy === 'bump') {
    if (parsedRange.length === 1) {
      if (element.operator === '^') {
        return `^${toVersion}`;
      }
      if (element.operator === '~') {
        return `~${toVersion}`;
      }
    }
    logger.warn(
      'Unsupported range type for rangeStrategy=bump: ' + currentVersion
    );
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
    let res;
    if (element.patch) {
      res = `<=${toVersion}`;
    } else if (element.minor) {
      res = `<=${getMajor(toVersion)}.${getMinor(toVersion)}`;
    } else {
      res = `<=${getMajor(toVersion)}`;
    }
    if (currentVersion.includes('<= ')) {
      res = res.replace('<=', '<= ');
    }
    return res;
  }
  if (element.operator === '<') {
    let res;
    if (currentVersion.endsWith('.0.0')) {
      const newMajor = getMajor(toVersion) + 1;
      res = `<${newMajor}.0.0`;
    } else if (element.patch) {
      res = `<${semver.inc(toVersion, 'patch')}`;
    } else if (element.minor) {
      res = `<${getMajor(toVersion)}.${getMinor(toVersion) + 1}`;
    } else {
      res = `<${getMajor(toVersion) + 1}`;
    }
    if (currentVersion.includes('< ')) {
      res = res.replace('<', '< ');
    }
    return res;
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
