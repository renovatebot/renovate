import type { RangeStrategy } from '../../../types/versioning';
import maven from '../maven';
import {
  TYPE_QUALIFIER,
  autoExtendMavenRange,
  isSubversion,
  tokenize,
} from '../maven/compare';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  LATEST_REGEX,
  REV_TYPE_LATEST,
  REV_TYPE_SUBREV,
  parseDynamicRevision,
} from './parse';

export const id = 'ivy';
export const displayName = 'Ivy';
export const urls = ['https://ant.apache.org/ivy/'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

/* eslint-disable @typescript-eslint/unbound-method */
const {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isGreaterThan,
  isStable,
  matches: mavenMatches,
  sortVersions,
} = maven;
/* eslint-enable @typescript-eslint/unbound-method */

function isValid(str: string): boolean {
  if (!str) {
    return false;
  }

  if (LATEST_REGEX.test(str)) {
    return true;
  }

  return isVersion(str) || !!parseDynamicRevision(str);
}

function isVersion(str: string): boolean {
  if (!str) {
    return false;
  }

  if (LATEST_REGEX.test(str)) {
    return false;
  }

  if (str.includes('+')) {
    return false;
  }

  return maven.isVersion(str);
}

function matches(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }
  const dynamicRevision = parseDynamicRevision(b);
  if (!dynamicRevision) {
    return equals(a, b);
  }
  const { type, value } = dynamicRevision;

  if (type === REV_TYPE_LATEST) {
    if (!value) {
      return true;
    }
    const tokens = tokenize(a);
    if (tokens.length) {
      const token = tokens[tokens.length - 1];
      if (token.type === TYPE_QUALIFIER) {
        return token.val.toLowerCase() === value;
      }
    }
    return false;
  }

  if (type === REV_TYPE_SUBREV) {
    return isSubversion(value, a);
  }

  return mavenMatches(a, value);
}

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

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return newVersion;
  }
  return autoExtendMavenRange(currentValue, newVersion);
}

function isCompatible(version: string): boolean {
  return isVersion(version);
}

function isSingleVersion(version: string): boolean {
  return isVersion(version);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible,
  isGreaterThan,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion: getSatisfyingVersion,
  getNewValue,
  sortVersions,
};

export default api;
