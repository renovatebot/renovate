import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'azure-rest-api';

// TODO
export const api: VersioningApi = {
  isCompatible(version: string, current?: string | undefined): boolean {
    return version === current;
  },
  isSingleVersion(version: string): boolean {
    return true;
  },
  isStable(version: string): boolean {
    return !version.endsWith('-preview');
  },
  isValid(input: string): boolean {
    return regEx(
      /^[0-9]{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])(?:-preview)?$/
    ).test(input);
  },
  isVersion(input: string | null | undefined): boolean {
    if (!input) {
      return false;
    }
    return this.isValid(input);
  },
  getMajor(version: string | import('semver/classes/semver')): number | null {
    throw new Error('Function not implemented.');
  },
  getMinor(version: string | import('semver/classes/semver')): number | null {
    throw new Error('Function not implemented.');
  },
  getPatch(version: string | import('semver/classes/semver')): number | null {
    throw new Error('Function not implemented.');
  },
  equals(version: string, other: string): boolean {
    return version === other;
  },
  isGreaterThan(version: string, other: string): boolean {
    throw new Error('Function not implemented.');
  },
  getSatisfyingVersion(versions: string[], range: string): string | null {
    throw new Error('Function not implemented.');
  },
  minSatisfyingVersion(versions: string[], range: string): string | null {
    throw new Error('Function not implemented.');
  },
  getNewValue(newValueConfig: NewValueConfig): string | null {
    throw new Error('Function not implemented.');
  },
  sortVersions(version: string, other: string): number {
    throw new Error('Function not implemented.');
  },
  matches(version: string, range: string): boolean {
    throw new Error('Function not implemented.');
  },
};
