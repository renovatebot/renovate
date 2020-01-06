import {
  isVersion,
  isValid,
  tokenize,
  compare,
  TYPE_NUMBER,
  TYPE_QUALIFIER,
  isSingleVersion,
  autoExtendMavenRange,
  parseRange,
  EXCLUDING_POINT,
  qualifierType,
  QualifierTypes,
} from './compare';
import { RangeStrategy, VersioningApi } from '../common';

const equals = (a: string, b: string): boolean => compare(a, b) === 0;

function matches(a: string, b: string): boolean {
  if (!b) return false;
  if (isVersion(b)) return equals(a, b);
  const ranges = parseRange(b);
  if (!ranges) return false;
  return ranges.reduce((result, range): any => {
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

const getMajor = (version: string): number | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const majorToken = tokens[0];
    return +majorToken.val;
  }
  return null;
};

const getMinor = (version: string): number | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const minorToken = tokens[1];
    if (minorToken && minorToken.type === TYPE_NUMBER) {
      return +minorToken.val;
    }
    return 0;
  }
  return null;
};

const getPatch = (version: string): number | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    const minorToken = tokens[1];
    const patchToken = tokens[2];
    if (
      patchToken &&
      minorToken.type === TYPE_NUMBER &&
      patchToken.type === TYPE_NUMBER
    ) {
      return +patchToken.val;
    }
    return 0;
  }
  return null;
};

const isGreaterThan = (a: string, b: string): boolean => compare(a, b) === 1;

const isStable = (version: string): boolean | null => {
  if (isVersion(version)) {
    const tokens = tokenize(version);
    for (const token of tokens) {
      if (token.type === TYPE_QUALIFIER) {
        const qualType = qualifierType(token);
        if (qualType && qualType < QualifierTypes.Release) {
          return false;
        }
      }
    }
    return true;
  }
  return null;
};

const maxSatisfyingVersion = (versions: string[], range: string): string => {
  // istanbul ignore next
  return versions.reduce((result, version) => {
    if (matches(version, range)) {
      if (!result) return version;
      if (isGreaterThan(version, result)) return version;
    }
    return result;
  }, null);
};

function getNewValue(
  currentValue: string,
  rangeStrategy: RangeStrategy,
  _fromVersion: string,
  toVersion: string
): string | null {
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return toVersion;
  }
  return autoExtendMavenRange(currentValue, toVersion);
}

export { isValid };

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion: maxSatisfyingVersion,
  getNewValue,
  sortVersions: compare,
};

export default api;
