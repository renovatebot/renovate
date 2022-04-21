import type { Range, SemVer } from 'semver';
import type { RangeStrategy } from '../../types';

export interface NewValueConfig {
  currentValue: string;
  rangeStrategy: RangeStrategy;
  currentVersion?: string;
  newVersion: string;
}
export interface VersioningApi {
  // validation
  isCompatible(version: string, current?: string): boolean;
  isSingleVersion(version: string): boolean;
  isStable(version: string): boolean;
  isValid(input: string): boolean;
  isVersion(input: string): boolean;

  // digestion of version
  getMajor(version: string | SemVer): null | number;
  getMinor(version: string | SemVer): null | number;
  getPatch(version: string | SemVer): null | number;

  // comparison
  equals(version: string, other: string): boolean;
  isGreaterThan(version: string, other: string): boolean;
  isLessThanRange?(version: string, range: string): boolean;
  getSatisfyingVersion(versions: string[], range: string): string | null;
  minSatisfyingVersion(versions: string[], range: string): string | null;
  getNewValue(newValueConfig: NewValueConfig): string | null;
  sortVersions(version: string, other: string): number;

  matches(version: string, range: string | Range): boolean;

  valueToVersion?(version: string): string;
}

export interface VersioningApiConstructor {
  new (config?: string): VersioningApi;
}
