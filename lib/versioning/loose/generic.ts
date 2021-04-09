import type { NewValueConfig, VersioningApi } from '../types';

export interface GenericVersion {
  release: number[];
  /** prereleases are treated in the standard semver manner, if present */
  prerelease?: string;
  suffix?: string;
}
export interface VersionParser {
  (version: string): GenericVersion;
}

export interface VersionComparator {
  (version: string, other: string): number;
}

// since this file was meant for no range support, a range = version
// parse should return null if version not valid
// parse should return an object with property release, an array of version sections major.minor.patch
export const parser = (parse: VersionParser): Partial<VersioningApi> => {
  function isValid(version: string): string {
    if (!version) {
      return null;
    }
    const parsed = parse(version);
    return parsed ? version : null;
  }
  function getSection(version: string, index: number): number {
    const parsed = parse(version);
    return parsed && parsed.release.length > index
      ? parsed.release[index]
      : null;
  }
  function getMajor(version: string): number {
    return getSection(version, 0);
  }
  function getMinor(version: string): number {
    return getSection(version, 1);
  }
  function getPatch(version: string): number {
    return getSection(version, 2);
  }

  function isStable(version: string): boolean {
    const parsed = parse(version);
    return parsed && !parsed.prerelease;
  }

  return {
    // validation
    isCompatible: isValid,
    isSingleVersion: isValid,
    isStable,
    isValid,
    isVersion: isValid,
    // digestion of version
    getMajor,
    getMinor,
    getPatch,
  };
};

// this is the main reason this file was created
// most operations below could be derived from a compare function
export const comparer = (
  compare: VersionComparator
): Partial<VersioningApi> => {
  function equals(version: string, other: string): boolean {
    return compare(version, other) === 0;
  }

  function isGreaterThan(version: string, other: string): boolean {
    return compare(version, other) > 0;
  }
  function isLessThanRange(version: string, range: string): boolean {
    return compare(version, range) < 0;
  }

  // we don't not have ranges, so versions has to be equal
  function getSatisfyingVersion(versions: string[], range: string): string {
    return versions.find((v) => equals(v, range)) || null;
  }
  function minSatisfyingVersion(versions: string[], range: string): string {
    return versions.find((v) => equals(v, range)) || null;
  }
  function getNewValue(newValueConfig: NewValueConfig): string {
    const { newVersion } = newValueConfig || {};
    return newVersion;
  }
  function sortVersions(version: string, other: string): number {
    return compare(version, other);
  }

  return {
    equals,
    isGreaterThan,
    isLessThanRange,
    matches: equals,
    getSatisfyingVersion,
    minSatisfyingVersion,
    getNewValue,
    sortVersions,
  };
};

// helper functions to ease create other versioning schemas with little code
// especially if those schemas do not support ranges
export const create = ({
  parse,
  compare,
}: {
  parse: VersionParser;
  compare: VersionComparator;
}): any => {
  let schema: VersioningApi = {} as any;
  if (parse) {
    schema = { ...schema, ...parser(parse) };
  }
  if (compare) {
    schema = { ...schema, ...comparer(compare) };
  }
  return schema;
};

export abstract class GenericVersioningApi<
  T extends GenericVersion = GenericVersion
> implements VersioningApi {
  private _getSection(version: string, index: number): number {
    const parsed = this._parse(version);
    return parsed && parsed.release.length > index
      ? parsed.release[index]
      : null;
  }

  protected abstract _compare(version: string, other: string): number;

  protected abstract _parse(version: string): T | null;

  isValid(version: string): boolean {
    return this._parse(version) !== null;
  }

  isCompatible(version: string, _range: string): boolean {
    return this.isValid(version);
  }

  isStable(version: string): boolean {
    const parsed = this._parse(version);
    return parsed && !parsed.prerelease;
  }

  isSingleVersion(version: string): string | boolean {
    return this.isValid(version);
  }

  isVersion(version: string): string | boolean {
    return this.isValid(version);
  }

  getMajor(version: string): number | null {
    return this._getSection(version, 0);
  }

  getMinor(version: string): number | null {
    return this._getSection(version, 1);
  }

  getPatch(version: string): number | null {
    return this._getSection(version, 2);
  }

  equals(version: string, other: string): boolean {
    return this._compare(version, other) === 0;
  }

  isGreaterThan(version: string, other: string): boolean {
    return this._compare(version, other) > 0;
  }

  isLessThanRange(version: string, range: string): boolean {
    return this._compare(version, range) < 0;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    return versions.find((v) => this.equals(v, range)) || null;
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    return versions.find((v) => this.equals(v, range)) || null;
  }

  // eslint-disable-next-line class-methods-use-this
  getNewValue(newValueConfig: NewValueConfig): string {
    const { newVersion } = newValueConfig || {};
    return newVersion;
  }

  sortVersions(version: string, other: string): number {
    return this._compare(version, other);
  }

  matches(version: string, range: string): boolean {
    return this.equals(version, range);
  }
}
