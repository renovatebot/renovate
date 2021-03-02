import type { NewValueConfig, VersioningApi } from '../types';
import {
  RangeBound,
  TokenType,
  compare,
  isValid,
  isVersion,
  parseMavenBasedRange,
  parsePrefixRange,
  tokenize,
} from './compare';

export const id = 'gradle';
export const displayName = 'Gradle';
export const urls = [
  'https://docs.gradle.org/current/userguide/single_versions.html#version_ordering',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin'];

const equals = (a: string, b: string): boolean => compare(a, b) === 0;

const getMajor = (version: string): number | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version.replace(/^v/i, ''));
    const majorToken = tokens[0];
    if (majorToken && majorToken.type === TokenType.Number) {
      return +majorToken.val;
    }
  }
  return null;
};

const getMinor = (version: string): number | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version.replace(/^v/i, ''));
    const majorToken = tokens[0];
    const minorToken = tokens[1];
    if (
      majorToken &&
      majorToken.type === TokenType.Number &&
      minorToken &&
      minorToken.type === TokenType.Number
    ) {
      return +minorToken.val;
    }
    return 0;
  }
  return null;
};

const getPatch = (version: string): number | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version.replace(/^v/i, ''));
    const majorToken = tokens[0];
    const minorToken = tokens[1];
    const patchToken = tokens[2];
    if (
      majorToken &&
      majorToken.type === TokenType.Number &&
      minorToken &&
      minorToken.type === TokenType.Number &&
      patchToken &&
      patchToken.type === TokenType.Number
    ) {
      return +patchToken.val;
    }
    return 0;
  }
  return null;
};

const isGreaterThan = (a: string, b: string): boolean => compare(a, b) === 1;

const unstable = new Set([
  'a',
  'alpha',
  'b',
  'beta',
  'm',
  'mt',
  'milestone',
  'rc',
  'cr',
  'snapshot',
]);

const isStable = (version: string): boolean | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    for (const token of tokens) {
      if (token.type === TokenType.String) {
        const val = token.val.toString().toLowerCase();
        if (unstable.has(val)) {
          return false;
        }
      }
    }
    return true;
  }
  return null;
};

const matches = (a: string, b: string): boolean => {
  if (!a || !isVersion(a) || !b) {
    return false;
  }
  if (isVersion(b)) {
    return equals(a, b);
  }

  const prefixRange = parsePrefixRange(b);
  if (prefixRange) {
    const tokens = prefixRange.tokens;
    if (tokens.length === 0) {
      return true;
    }
    const versionTokens = tokenize(a);
    const x = versionTokens
      .slice(0, tokens.length)
      .map(({ val }) => val)
      .join('.');
    const y = tokens.map(({ val }) => val).join('.');
    return equals(x, y);
  }

  const mavenBasedRange = parseMavenBasedRange(b);
  if (!mavenBasedRange) {
    return null;
  }

  const { leftBound, leftVal, rightBound, rightVal } = mavenBasedRange;
  let leftResult = true;
  let rightResult = true;

  if (leftVal) {
    leftResult =
      leftBound === RangeBound.Exclusive
        ? compare(leftVal, a) === -1
        : compare(leftVal, a) !== 1;
  }

  if (rightVal) {
    rightResult =
      rightBound === RangeBound.Exclusive
        ? compare(a, rightVal) === -1
        : compare(a, rightVal) !== 1;
  }

  return leftResult && rightResult;
};

const getSatisfyingVersion = (versions: string[], range: string): string =>
  versions.reduce((result, version) => {
    if (matches(version, range)) {
      if (!result) {
        return version;
      }
      if (isGreaterThan(version, result)) {
        return version;
      }
    }
    return result;
  }, null);

const minSatisfyingVersion = (versions: string[], range: string): string =>
  versions.reduce((result, version) => {
    if (matches(version, range)) {
      if (!result) {
        return version;
      }
      if (compare(version, result) === -1) {
        return version;
      }
    }
    return result;
  }, null);

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return newVersion;
  }
  return null;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion: isVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions: compare,
};

export default api;
