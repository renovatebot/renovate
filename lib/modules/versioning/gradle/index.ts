import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  TokenType,
  compare,
  isValid,
  isVersion,
  parse,
  parseMavenBasedRange,
  parsePrefixRange,
} from './compare';

export const id = 'gradle';
export const displayName = 'Gradle';
export const urls = [
  'https://docs.gradle.org/current/userguide/single_versions.html#version_ordering',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['pin'];

const equals = (a: string, b: string): boolean => compare(a, b) === 0;

const getMajor = (version: string): number | null => {
  const tokens = parse(version?.replace(regEx(/^v/i), ''));
  if (tokens) {
    const majorToken = tokens?.[0];
    if (majorToken && majorToken.type === TokenType.Number) {
      return majorToken.val as number;
    }
  }
  return null;
};

const getMinor = (version: string): number | null => {
  const tokens = parse(version?.replace(regEx(/^v/i), ''));
  if (tokens) {
    const majorToken = tokens[0];
    const minorToken = tokens[1];
    if (
      majorToken &&
      majorToken.type === TokenType.Number &&
      minorToken &&
      minorToken.type === TokenType.Number
    ) {
      return minorToken.val as number;
    }
    return 0;
  }
  return null;
};

const getPatch = (version: string): number | null => {
  const tokens = parse(version?.replace(regEx(/^v/i), ''));
  if (tokens) {
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
      return patchToken.val as number;
    }
    return 0;
  }
  return null;
};

const isGreaterThan = (a: string, b: string): boolean => compare(a, b) === 1;

const unstable = new Set([
  'dev',
  'a',
  'alpha',
  'b',
  'beta',
  'm',
  'mt',
  'milestone',
  'rc',
  'cr',
  'preview',
  'snapshot',
]);

const isStable = (version: string): boolean => {
  const tokens = parse(version);
  if (tokens) {
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
  return false;
};

const matches = (a: string, b: string): boolean => {
  const versionTokens = parse(a);
  if (!a || !versionTokens || !b) {
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
    const x = versionTokens
      .slice(0, tokens.length)
      .map(({ val }) => val)
      .join('.');
    const y = tokens.map(({ val }) => val).join('.');
    return equals(x, y);
  }

  const mavenBasedRange = parseMavenBasedRange(b);
  if (!mavenBasedRange) {
    return false;
  }

  const { leftBound, leftVal, rightBound, rightVal } = mavenBasedRange;
  let leftResult = true;
  let rightResult = true;

  if (leftVal) {
    leftResult =
      leftBound === 'exclusive'
        ? compare(leftVal, a) === -1
        : compare(leftVal, a) !== 1;
  }

  if (rightVal) {
    rightResult =
      rightBound === 'exclusive'
        ? compare(a, rightVal) === -1
        : compare(a, rightVal) !== 1;
  }

  return leftResult && rightResult;
};

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return versions.reduce((result: string | null, version) => {
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
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return versions.reduce((result: string | null, version) => {
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
}

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return newVersion;
  }

  // Check if our version is of the form "1.2.+"
  const prefixRange = parsePrefixRange(currentValue);
  const parsedNewVersion = parse(newVersion);
  if (prefixRange && parsedNewVersion) {
    if (prefixRange.tokens.length > 0) {
      if (prefixRange.tokens.length <= parsedNewVersion.length) {
        const newPrefixed = prefixRange.tokens
          .map((_, i) => parsedNewVersion[i].val)
          .join('.');

        return `${newPrefixed}.+`;
      } else {
        // our new version is shorter than our prefix range so drop our prefix range
        return newVersion;
      }
    } else {
      // our version is already "+" which includes ever version
      return null;
    }
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
