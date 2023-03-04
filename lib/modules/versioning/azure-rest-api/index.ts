import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'azure-rest-api';
export const displayName = 'azure-rest-api';

export const urls = [];

export const supportsRanges = false;

export const api: VersioningApi = {
  isCompatible(version: string, current?: string | undefined): boolean {
    return version === current;
  },
  isSingleVersion(version: string): boolean {
    return true;
  },
  isStable(version: string): boolean {
    return version.length <= 10;
  },
  isValid(input: string): boolean {
    const isValid = regEx(/^\d{4}-\d{2}-\d{2}(?:-[a-z]+)?$/).test(input);
    logger.info(`hello from is valid ${isValid}`);
    return isValid;
  },
  isVersion(input: string | null | undefined): boolean {
    if (!input) {
      return false;
    }
    return this.isValid(input);
  },
  // TODO: how to deal with functions that do not make sense for this versioning?
  getMajor(version: string | import('semver/classes/semver')): number | null {
    throw new Error('Function not implemented.');
  },
  // TODO: how to deal with functions that do not make sense for this versioning?
  getMinor(version: string | import('semver/classes/semver')): number | null {
    throw new Error('Function not implemented.');
  },
  // TODO: how to deal with functions that do not make sense for this versioning?
  getPatch(version: string | import('semver/classes/semver')): number | null {
    throw new Error('Function not implemented.');
  },
  equals(version: string, other: string): boolean {
    return version === other;
  },
  isGreaterThan(version: string, other: string): boolean {
    return this.sortVersions(version, other) === 1;
  },
  // TODO: how to deal with functions that do not make sense for this versioning?
  getSatisfyingVersion(versions: string[], range: string): string | null {
    throw new Error('Function not implemented.');
  },
  // TODO: how to deal with functions that do not make sense for this versioning?
  minSatisfyingVersion(versions: string[], range: string): string | null {
    throw new Error('Function not implemented.');
  },
  getNewValue(newValueConfig: NewValueConfig): string | null {
    return newValueConfig.newVersion;
  },
  sortVersions(version: string, other: string): number {
    if (this.equals(version, other)) {
      return 0;
    }
    return version > other ? 1 : -1;
  },
  // TODO: how to deal with functions that do not make sense for this versioning?
  matches(version: string, range: string): boolean {
    throw new Error('Function not implemented.');
  },
};

export default api;
