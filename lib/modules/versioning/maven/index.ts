import type { RangeStrategy } from '../../../types/versioning';
import { coerceString } from '../../../util/string';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  EXCLUDING_POINT,
  QualifierTypes,
  TYPE_NUMBER,
  TYPE_QUALIFIER,
  autoExtendMavenRange,
  compare,
  isSingleVersion,
  isValid,
  isVersion,
  parseRange,
  qualifierType,
  tokenize,
} from './compare';

export const id = 'maven';
export const displayName = 'Maven';
export const urls = [
  'https://maven.apache.org/pom.html#Dependency_Version_Requirement_Specification',
  'https://octopus.com/blog/maven-versioning-explained',
  'https://maven.apache.org/enforcer/enforcer-rules/versionRanges.html',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

const equals = (a: string, b: string): boolean => compare(a, b) === 0;

function matches(a: string, b: string): boolean {
  if (!b) {
    return false;
  }
  if (isVersion(b)) {
    return equals(a, b);
  }
  const ranges = parseRange(b);
  if (!ranges) {
    return false;
  }
  return ranges.reduce((result, range): any => {
    if (result) {
      return result;
    }

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

const isStable = (version: string): boolean => {
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
  return false;
};

// istanbul ignore next
const getSatisfyingVersion = (
  versions: string[],
  range: string,
): string | null =>
  versions.reduce((result: string | null, version) => {
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

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string {
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return newVersion;
  }
  return coerceString(
    autoExtendMavenRange(currentValue, newVersion),
    currentValue,
  );
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
  getSatisfyingVersion,
  minSatisfyingVersion: getSatisfyingVersion,
  getNewValue,
  sortVersions: compare,
};

export default api;
