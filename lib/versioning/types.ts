import type { Range, SemVer } from 'semver';
import type { RangeStrategy } from '../types';

export interface NewValueConfig {
  currentValue: string;
  rangeStrategy: RangeStrategy;
  currentVersion?: string;
  newVersion: string;
}
export interface VersioningApi {
  // validation
  isCompatible(version: string, range?: string): string | boolean | null;
  isSingleVersion(version: string): string | boolean | null;
  isStable(version: string): boolean;
  isValid(version: string): string | boolean | null;
  isVersion(version: string): string | boolean | null;

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
  getNewValue(newValueConfig: NewValueConfig): string;
  sortVersions(version: string, other: string): number;

  matches(version: string, range: string | Range): boolean;

  valueToVersion?(version: string): string;
}

export interface VersioningApiConstructor {
  new (config?: string): VersioningApi;
}
