import { isUndefined } from '@sindresorhus/is';
import type { SemVer } from 'semver';
import semver from 'semver';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import {
  createPartialSemverOps,
  massageValue,
  parsePartialRange,
} from './common.ts';

export const id = 'semver-partial';
export const displayName = 'Partial Semantic Versioning';
export const urls = [
  '[GitLab CI components - Partial semantic versions](https://docs.gitlab.com/ci/components/#partial-semantic-versions)',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'replace'];

function isLatest(input: string): boolean {
  return input === '~latest';
}

function parseVersion(input: string): SemVer | null {
  return semver.parse(massageValue(input));
}

function isValid(input: string): boolean {
  return isLatest(input) || !!parseVersion(input) || !!parsePartialRange(input);
}

function isVersion(input: string | undefined | null): boolean {
  if (!input) {
    return false;
  }

  return !!parseVersion(input);
}

function matchesLatest(version: string, range: string): boolean {
  return !!parseVersion(version) && isLatest(range);
}

const ops = createPartialSemverOps({
  parseVersion,
  parseRange: parsePartialRange,
  matchesAlias: matchesLatest,
});

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  if (rangeStrategy === 'pin') {
    return newVersion;
  }

  if (isLatest(currentValue)) {
    return currentValue;
  }

  const range = parsePartialRange(currentValue);
  if (!range) {
    return newVersion;
  }

  const newParsed = parseVersion(newVersion);
  if (!newParsed) {
    return newVersion;
  }

  // Check if currentValue is a full version (has patch component)
  const currentParsed = parseVersion(currentValue);
  if (currentParsed) {
    // currentValue is a full version, return full newVersion
    return newVersion;
  }

  const [prefix] = currentValue.split(massageValue(currentValue));

  if (isUndefined(range.minor)) {
    return `${prefix}${newParsed.major}`;
  }

  return `${prefix}${newParsed.major}.${newParsed.minor}`;
}

function isCompatible(version: string): boolean {
  return isValid(version);
}

export const api: VersioningApi = {
  ...ops,
  isCompatible,
  isValid,
  isVersion,
  getNewValue,
};

export default api;
