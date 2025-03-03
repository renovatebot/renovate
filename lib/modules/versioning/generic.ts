import is from '@sindresorhus/is';
import type { NewValueConfig, VersioningApi } from './types';

export interface GenericVersion {
  release: number[];
  /** prereleases are treated in the standard semver manner, if present */
  prerelease?: string;
  suffix?: string;
}
export type VersionParser = (version: string) => GenericVersion;

export type VersionComparator = (version: string, other: string) => number;

export abstract class GenericVersioningApi<
  T extends GenericVersion = GenericVersion,
> implements VersioningApi
{
  private _getSection(version: string, index: number): number | null {
    const parsed = this._parse(version);
    return parsed && parsed.release.length > index
      ? parsed.release[index]
      : null;
  }

  protected _compare(version: string, other: string): number {
    const left = this._parse(version);
    const right = this._parse(other);

    // istanbul ignore if
    if (!(left && right)) {
      return 1;
    }

    // support variable length compare
    const length = Math.max(left.release.length, right.release.length);
    for (let i = 0; i < length; i += 1) {
      // 2.1 and 2.1.0 are equivalent
      const part1 = left.release[i] ?? 0;
      const part2 = right.release[i] ?? 0;
      if (part1 !== part2) {
        return part1 - part2;
      }
    }

    if (
      is.nonEmptyString(left.prerelease) &&
      is.nonEmptyString(right.prerelease)
    ) {
      const pre = left.prerelease.localeCompare(right.prerelease, undefined, {
        numeric: true,
      });

      if (pre !== 0) {
        return pre;
      }
    } else if (is.nonEmptyString(left.prerelease)) {
      return -1;
    } else if (is.nonEmptyString(right.prerelease)) {
      return 1;
    }

    return this._compareOther(left, right);
  }

  /*
   * virtual
   */

  protected _compareOther(_left: T, _right: T): number {
    return 0;
  }

  protected abstract _parse(version: string): T | null;

  isValid(version: string): boolean {
    return this._parse(version) !== null;
  }

  isCompatible(version: string, _current: string): boolean {
    return this.isValid(version);
  }

  isStable(version: string): boolean {
    const parsed = this._parse(version);
    return !!(parsed && !parsed.prerelease);
  }

  isSingleVersion(version: string): boolean {
    return this.isValid(version);
  }

  isVersion(version: string): boolean {
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
    const result = versions.find((v) => this.equals(v, range));
    return result ?? null;
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    const result = versions.find((v) => this.equals(v, range));
    return result ?? null;
  }

  getNewValue({
    currentValue,
    currentVersion,
    newVersion,
  }: NewValueConfig): string | null {
    if (currentVersion === `v${currentValue}`) {
      return newVersion.replace(/^v/, '');
    }
    return newVersion ?? null;
  }

  sortVersions(version: string, other: string): number {
    return this._compare(version, other);
  }

  matches(version: string, range: string): boolean {
    return this.equals(version, range);
  }

  isSame(type: 'major' | 'minor' | 'patch', a: string, b: string): boolean {
    if (type === 'major') {
      return this.getMajor(a) === this.getMajor(b);
    }
    if (type === 'minor') {
      return this.getMinor(a) === this.getMinor(b);
    }
    return this.getPatch(a) === this.getPatch(b);
  }
}
