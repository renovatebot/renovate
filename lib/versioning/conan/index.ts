import * as semver from 'semver';
import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import { api as looseAPI } from '../loose';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  cleanVersion,
  containsOperators,
  fixParsedRange,
  getOptions,
  matchesWithOptions,
} from './common';

export const id = 'conan';
export const displayName = 'conan';
export const urls = [
  'https://semver.org/',
  'https://github.com/podhmo/python-node-semver',
  'https://github.com/podhmo/python-node-semver/tree/master/examples',
  'https://docs.conan.io/en/latest/versioning/version_ranges.html#version-ranges',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['auto', 'bump', 'widen', 'replace'];

const MIN = 1;
const MAX = -1;

const makeVersion = (
  version: string,
  options: semver.Options
): string | boolean => {
  const splitVersion = version.split('.');
  const prerelease = semver.prerelease(version, options);

  if (prerelease && !options.includePrerelease) {
    if (!Number.isNaN(+prerelease[0])) {
      const stringVersion = `${splitVersion[0]}.${splitVersion[1]}.${splitVersion[2]}`;
      return semver.valid(stringVersion, options);
    }
    return false;
  }

  if (
    options.loose &&
    !semver.valid(version, options) &&
    splitVersion.length !== 3
  ) {
    return semver.valid(semver.coerce(version, options), options);
  }

  return semver.valid(version, options);
};

const isVersion = (input: string): string | boolean => {
  if (input && !input.includes('[')) {
    const qualifiers = getOptions(input);
    const version = cleanVersion(input);
    let looseResult = null;
    if (qualifiers.loose) {
      looseResult = looseAPI.isVersion(version);
    }
    return makeVersion(version, qualifiers) || looseResult;
  }
  return false;
};

const isValid = (input: string): string | boolean => {
  const version = cleanVersion(input);
  const qualifiers = getOptions(input);
  if (makeVersion(version, qualifiers)) {
    return version;
  }

  return semver.validRange(version, qualifiers);
};

// always include prereleases
const getMajor = (version: string): null | number => {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  options.includePrerelease = true;
  const cleanerVersion = makeVersion(cleanedVersion, options);
  if (typeof cleanerVersion === 'string') {
    return Number(cleanerVersion.split('.')[0]);
  }
  return null;
};

// always include prereleases
const getMinor = (version: string): null | number => {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  options.includePrerelease = true;
  const cleanerVersion = makeVersion(cleanedVersion, options);
  if (typeof cleanerVersion === 'string') {
    return Number(cleanerVersion.split('.')[1]);
  }
  return null;
};

// always include prereleases
const getPatch = (version: string): null | number => {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  options.includePrerelease = true;
  const cleanerVersion = makeVersion(cleanedVersion, options);

  if (typeof cleanerVersion === 'string') {
    const newVersion = semver.valid(
      semver.coerce(cleanedVersion, options),
      options
    );
    return Number(newVersion.split('.')[2]);
  }
  return null;
};

const equals = (version: string, other: string): boolean => {
  const cleanedVersion = cleanVersion(version);
  const cleanOther = cleanVersion(other);
  const options = { loose: true, includePrerelease: true };
  const looseResult = looseAPI.equals(cleanedVersion, cleanOther);
  try {
    return semver.eq(cleanedVersion, cleanOther, options) || looseResult;
  } catch {
    return looseResult;
  }
};

const isGreaterThan = (version: string, other: string): boolean => {
  const cleanedVersion = cleanVersion(version);
  const cleanOther = cleanVersion(other);
  const options = { loose: true, includePrerelease: true };
  const looseResult = looseAPI.isGreaterThan(cleanedVersion, cleanOther);
  try {
    return semver.gt(cleanedVersion, cleanOther, options) || looseResult;
  } catch {
    return looseResult;
  }
};

const isLessThanRange = (version: string, range: string): boolean => {
  const cleanedVersion = cleanVersion(version);
  const cleanRange = cleanVersion(range);
  const options = getOptions(range);
  const looseResult = looseAPI.isLessThanRange(cleanedVersion, cleanRange);
  try {
    return semver.ltr(cleanedVersion, cleanRange, options) || looseResult;
  } catch {
    return looseResult;
  }
};

const sortVersions = (version: string, other: string): number => {
  const cleanedVersion = cleanVersion(version);
  const cleanOther = cleanVersion(other);
  const options = { loose: true, includePrerelease: true };
  try {
    return semver.compare(cleanedVersion, cleanOther, options);
  } catch {
    return looseAPI.sortVersions(cleanedVersion, cleanOther);
  }
};

const matches = (version: string, range: string): boolean => {
  if (isVersion(version) && isVersion(range)) {
    return true;
  }
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(range);
  const cleanRange = cleanVersion(range);
  return matchesWithOptions(cleanedVersion, cleanRange, options);
};

const isCompatible = (version: string, range: string): boolean => {
  if (isVersion(version) && isVersion(range)) {
    return true;
  }
  const options = getOptions(range);
  const compatibleVersion = makeVersion(version, options);
  if (compatibleVersion) {
    return !isLessThanRange(version, range);
  }
  return false;
};

const isStable = (_: string): boolean => true;

const findSatisfyingVersion = (
  versions: string[],
  range: string,
  compareRt: number
): string | null => {
  const options = getOptions(range);
  let cur = null;
  let curSV = null;
  let index = 0;
  let curIndex = -1;

  versions.forEach((v) => {
    const versionFromList = makeVersion(v, options);
    if (typeof versionFromList === 'string') {
      if (matches(versionFromList, range)) {
        if (
          !cur ||
          semver.compare(curSV, versionFromList, options) === compareRt
        ) {
          cur = versionFromList;
          curIndex = index;
          curSV = new semver.SemVer(cur, options);
        }
      }
    }
    index += 1;
  });
  if (curIndex >= 0) {
    return versions[curIndex];
  }
  return null;
};

const minSatisfyingVersion = (
  versions: string[],
  range: string
): string | null => findSatisfyingVersion(versions, range, MIN);

const getSatisfyingVersion = (
  versions: string[],
  range: string
): string | null => findSatisfyingVersion(versions, range, MAX);

function replaceRange({ currentValue, newVersion }: NewValueConfig): string {
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];
  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const toVersionPatch = getPatch(newVersion);
  const suffix = semver.prerelease(newVersion)
    ? '-' + String(semver.prerelease(newVersion)[0])
    : '';

  if (element.operator === '~>') {
    return `~> ${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '=') {
    return `=${newVersion}`;
  }
  if (element.operator === '~') {
    if (suffix.length) {
      return `~${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
    }
    return `~${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '<=') {
    let res;
    if (element.patch || suffix.length) {
      res = `<=${newVersion}`;
    } else if (element.minor) {
      res = `<=${toVersionMajor}.${toVersionMinor}`;
    } else {
      res = `<=${toVersionMajor}`;
    }
    if (currentValue.includes('<= ')) {
      res = res.replace('<=', '<= ');
    }
    return res;
  }
  if (element.operator === '<') {
    let res;
    if (currentValue.endsWith('.0.0')) {
      const newMajor = toVersionMajor + 1;
      res = `<${newMajor}.0.0`;
    } else if (element.patch) {
      res = `<${semver.inc(newVersion, 'patch')}`;
    } else if (element.minor) {
      res = `<${toVersionMajor}.${toVersionMinor + 1}`;
    } else {
      res = `<${toVersionMajor + 1}`;
    }
    if (currentValue.includes('< ')) {
      res = res.replace(/</g, '< ');
    }
    return res;
  }
  if (element.operator === '>') {
    let res;
    if (currentValue.endsWith('.0.0')) {
      const newMajor = toVersionMajor + 1;
      res = `>${newMajor}.0.0`;
    } else if (element.patch) {
      res = `>${toVersionMajor}.${toVersionMinor}.${toVersionPatch}`;
    } else if (element.minor) {
      res = `>${toVersionMajor}.${toVersionMinor}`;
    } else {
      res = `>${toVersionMajor}`;
    }
    if (currentValue.includes('> ')) {
      res = res.replace(/</g, '> ');
    }
    return res;
  }
  if (!element.operator) {
    if (element.minor) {
      if (element.minor === 'x') {
        return `${toVersionMajor}.x`;
      }
      if (element.minor === '*') {
        return `${toVersionMajor}.*`;
      }
      if (element.patch === 'x') {
        return `${toVersionMajor}.${toVersionMinor}.x`;
      }
      if (element.patch === '*') {
        return `${toVersionMajor}.${toVersionMinor}.*`;
      }
      return `${newVersion}`;
    }
    return `${toVersionMajor}`;
  }
  return newVersion;
}

function widenRange(
  { currentValue, currentVersion, newVersion }: NewValueConfig,
  options: semver.Options
): string {
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];

  if (matchesWithOptions(newVersion, currentValue, options)) {
    return currentValue;
  }
  const newValue = replaceRange({
    currentValue,
    rangeStrategy: 'replace',
    currentVersion,
    newVersion,
  });
  if (element.operator?.startsWith('<')) {
    const splitCurrent = currentValue.split(element.operator);
    splitCurrent.pop();
    return splitCurrent.join(element.operator) + newValue;
  }
  if (parsedRange.length > 1) {
    const previousElement = parsedRange[parsedRange.length - 2];
    if (previousElement.operator === '-') {
      const splitCurrent = currentValue.split('-');
      splitCurrent.pop();
      return splitCurrent.join('-') + '- ' + newValue;
    }
    if (element.operator?.startsWith('>')) {
      logger.warn(`Complex ranges ending in greater than are not supported`);
      return null;
    }
  }
  return `${currentValue} || ${newValue}`;
}

function bumpRange(
  { currentValue, currentVersion, newVersion }: NewValueConfig,
  options: semver.Options
): string {
  if (!containsOperators(currentValue) && currentValue.includes('||')) {
    return widenRange(
      {
        currentValue,
        rangeStrategy: 'widen',
        currentVersion,
        newVersion,
      },
      options
    );
  }
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];

  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const suffix = semver.prerelease(newVersion)
    ? '-' + String(semver.prerelease(newVersion)[0])
    : '';

  if (parsedRange.length === 1) {
    if (!element.operator) {
      return replaceRange({
        currentValue,
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
    }
    if (element.operator.startsWith('~')) {
      const split = currentValue.split('.');
      if (suffix.length) {
        return `${element.operator}${newVersion}`;
      }
      if (split.length === 1) {
        // ~4
        return `${element.operator}${toVersionMajor}`;
      }
      if (split.length === 2) {
        // ~4.1
        return `${element.operator}${toVersionMajor}.${toVersionMinor}`;
      }
      return `${element.operator}${newVersion}`;
    }
    if (element.operator === '=') {
      return `=${newVersion}`;
    }
    if (element.operator === '>=') {
      return currentValue.includes('>= ')
        ? `>= ${newVersion}`
        : `>=${newVersion}`;
    }
    if (element.operator.startsWith('<')) {
      return currentValue;
    }
  } else {
    const newRange = fixParsedRange(currentValue);
    const versions = newRange.map((x) => {
      // don't bump or'd single version values
      if (x.operator === '||') {
        return x.semver;
      }
      if (x.operator) {
        const bumpedSubRange = bumpRange(
          {
            currentValue: x.semver,
            rangeStrategy: 'bump',
            currentVersion,
            newVersion,
          },
          options
        );
        if (matchesWithOptions(newVersion, bumpedSubRange, options)) {
          return bumpedSubRange;
        }
      }

      return replaceRange({
        currentValue: x.semver,
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
    });
    return versions.filter((x) => x !== null && x !== '').join(' ');
  }
  logger.debug(
    'Unsupported range type for rangeStrategy=bump: ' + currentValue
  );
  return null;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  const cleanRange = cleanVersion(currentValue);
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return newVersion;
  }
  const options = getOptions(currentValue);
  let newValue = '';

  if (rangeStrategy === 'widen') {
    newValue = widenRange(
      { currentValue: cleanRange, rangeStrategy, currentVersion, newVersion },
      options
    );
  } else if (rangeStrategy === 'bump') {
    newValue = bumpRange(
      { currentValue: cleanRange, rangeStrategy, currentVersion, newVersion },
      options
    );
  } else {
    newValue = replaceRange({
      currentValue: cleanRange,
      rangeStrategy,
      currentVersion,
      newVersion,
    });
  }

  if (newValue) {
    return currentValue.replace(cleanRange, newValue);
  }

  return null;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getNewValue,
  getPatch,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion: isVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
