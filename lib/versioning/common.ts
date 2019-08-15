import { SemVer, Range } from 'semver';

export type RangeStrategy =
  | 'auto'
  | 'bump'
  | 'future'
  | 'pin'
  | 'replace'
  | 'update-lockfile'
  | 'widen';

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
  maxSatisfyingVersion(versions: string[], range: string): string | null;
  minSatisfyingVersion(versions: string[], range: string): string | null;
  getNewValue(
    currentValue: string,
    rangeStrategy: RangeStrategy,
    fromVersion: string,
    toVersion: string
  ): string;
  sortVersions(version: string, other: string): number;

  matches(version: string, range: string | Range): boolean;

  valueToVersion?(version: string): string;
}

export interface VersioningApiConstructor {
  new (config?: string): VersioningApi;
}

export function isVersioningApiConstructor(
  obj: VersioningApi | VersioningApiConstructor
): obj is VersioningApiConstructor {
  return typeof obj === 'function';
}
