import { VersioningApi } from '../common';
import * as generic from '../loose/generic';
import {
  compare,
  parse,
  parseFloatingRange,
  parseIntervalRange,
} from './parse';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = false;

function isValid(version: string): boolean {
  return !!(
    parse(version) ||
    parseFloatingRange(version) ||
    parseIntervalRange(version)
  );
}

function isVersion(version: string): boolean {
  return !!parse(version);
}

function isSingleVersion(version: string): boolean | null {
  const parsed = parse(version);
  return parsed?.isExact ?? null;
}

function isStable(version: string): boolean {
  const parsed = parse(version);
  return parsed && parsed.suffix === '';
}

function isLessThanRange(version: string, range: string): boolean {
  if (isVersion(range)) {
    return compare(version, range) < 0;
  }

  const floatingRange = parseFloatingRange(range);
  if (floatingRange) {
    return compare(version, range.replace('*', '0')) < 0;
  }

  const intervalRange = parseIntervalRange(range);
  if (intervalRange) {
    const { leftBracket, leftValue } = intervalRange;
    if (!leftValue) {
      return false;
    }
    if (leftBracket === '(') {
      return compare(version, leftValue) <= 0;
    }
    if (leftBracket === '[') {
      return compare(version, leftValue) < 0;
    }
  }

  return false;
}

function matches(v: string, r: string): boolean {
  if (isVersion(r)) {
    return compare(v, r) === 0;
  }

  const intervalRange = parseIntervalRange(r);
  if (intervalRange) {
    const { leftBracket, leftValue, rightBracket, rightValue } = intervalRange;
    let result = true;
    if (
      leftValue &&
      (leftBracket === '['
        ? compare(v, leftValue) < 0
        : compare(v, leftValue) <= 0)
    ) {
      result = false;
    }
    if (
      rightValue &&
      (rightBracket === ']'
        ? compare(rightValue, v) < 0
        : compare(rightValue, v) <= 0)
    ) {
      result = false;
    }
    return result;
  }

  const floatingRange = parseFloatingRange(r);
  if (floatingRange) {
    const range = floatingRange;
    const version = parse(v);
    const length = Math.max(version.release.length, range.release.length);
    for (let i = 0; i < length; i += 1) {
      const versionPart = version.release[i] || 0;
      const rangePart = range.release[i] || 0;
      if (rangePart === '*') {
        return true;
      }
      if (versionPart !== rangePart) {
        return false;
      }
    }
    if (range.suffix === '*' && version.suffix) {
      return true;
    }
  }

  return false;
}

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isValid,
  isVersion,
  isSingleVersion,
  isStable,
  isLessThanRange,
  matches,
};

export default api;
