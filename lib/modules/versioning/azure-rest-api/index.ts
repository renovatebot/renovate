import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'azure-rest-api';

// TODO
export const api: VersioningApi = {
  isCompatible(version: string, current?: string | undefined): boolean {
    throw new Error('Function not implemented.');
  },
  isSingleVersion(version: string): boolean {
    throw new Error('Function not implemented.');
  },
  isStable(version: string): boolean {
    throw new Error('Function not implemented.');
  },
  isValid(input: string): boolean {
    throw new Error('Function not implemented.');
  },
  isVersion(input: string | null | undefined): boolean {
    throw new Error('Function not implemented.');
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
    throw new Error('Function not implemented.');
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
