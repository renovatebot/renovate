import { regEx } from '../../../util/regex';
import { RegExpVersion, RegExpVersioningApi } from '../regex';
import type { VersioningApiConstructor } from '../types';

export class HermitVersioning extends RegExpVersioningApi {
  static versionRegex =
    '^(?<major>\\d+)(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?(_(?<build>\\d+))?([-]?(?<prerelease>[^.+][^+]*))?([+](?<compatibility>[^.-][^+]*))?$';
  private _hermitConfig: RegExp | null = null;

  public constructor() {
    super(HermitVersioning.versionRegex);
    this._hermitConfig = regEx(HermitVersioning.versionRegex);
  }

  _parseVersion(version: string): RegExpVersion | null {
    return this._parse(version);
  }

  private _isValidSemver(version: string): boolean {
    const parsed = super._parse(version);
    return parsed !== null;
  }

  protected override _parse(version: string): RegExpVersion | null {
    const parsed = super._parse(version);
    if (parsed) {
      return parsed;
    }
    const channelVer = this._getChannel(version);

    const groups = this._hermitConfig?.exec(channelVer)?.groups;

    if (!groups) {
      return null;
    }

    const { major, minor, patch, build, prerelease, compatibility } = groups;
    const release = [];

    if (major) {
      release.push(Number.parseInt(major, 10));
    }

    if (minor) {
      release.push(Number.parseInt(minor, 10));
    }
    if (patch) {
      release.push(Number.parseInt(patch, 10));
    }
    if (build) {
      release.push(Number.parseInt(build, 10));
    }

    return {
      release,
      prerelease: prerelease,
      compatibility: compatibility,
    };
  }

  _isChannel(version: string): boolean {
    return version.startsWith('@');
  }

  private _getChannel(version: string): string {
    return version.substring(1);
  }

  _isSemverChannel(version: string): boolean {
    return this._isChannel(version) && this.isValid(this._getChannel(version));
  }

  override isStable(version: string): boolean {
    if (this._isValidSemver(version)) {
      return super.isStable(version);
    }

    // channel and the rest should be considered unstable version
    // as channels are changing values
    return false;
  }

  override isValid(version: string): boolean {
    return this._isValidSemver(version) || this._isChannel(version);
  }

  private _getVersionPart(
    partFn: (version: string) => null | number,
    version: string
  ): null | number {
    if (this._isValidSemver(version) || this._isSemverChannel(version)) {
      return partFn(version);
    }

    return null;
  }

  override getMajor(version: string): null | number {
    return this._getVersionPart((version) => super.getMajor(version), version);
  }

  override getMinor(version: string): null | number {
    return this._getVersionPart((version) => super.getMinor(version), version);
  }

  override getPatch(version: string): null | number {
    return this._getVersionPart((version) => super.getPatch(version), version);
  }

  override equals(version: string, other: string): boolean {
    // compare semver when both are
    if (this._isValidSemver(version) && this._isValidSemver(other)) {
      return super.equals(version, other);
    }
    const parsedVersion = this._parse(version);
    const parsedOther = this._parse(other);

    if (parsedVersion !== null && parsedOther !== null) {
      const versionReleases = parsedVersion.release;
      const otherReleases = parsedOther.release;

      if (versionReleases.length !== otherReleases.length) {
        return false;
      }

      for (let i = 0; i < versionReleases.length; i++) {
        if (versionReleases[i] !== otherReleases[i]) {
          return false;
        }
      }

      return true;
    }

    return version === other;
  }

  override isGreaterThan(version: string, other: string): boolean {
    return this.sortVersions(version, other) > 0;
  }

  override isLessThanRange(version: string, range: string): boolean {
    return !this.isGreaterThan(version, range);
  }

  private _filterVersions(versions: string[]): string[] {
    return versions
      .filter((v) => {
        return this._isValidSemver(v) || this._isSemverChannel(v);
      })
      .map((v) => {
        if (this._isSemverChannel(v)) {
          return this._getChannel(v);
        }

        return v;
      });
  }

  override getSatisfyingVersion(
    versions: string[],
    range: string
  ): string | null {
    return super.getSatisfyingVersion(this._filterVersions(versions), range);
  }

  override minSatisfyingVersion(
    versions: string[],
    range: string
  ): string | null {
    return super.minSatisfyingVersion(this._filterVersions(versions), range);
  }

  override sortVersions(version: string, other: string): number {
    if (this._isValidSemver(version) && this._isValidSemver(other)) {
      return super.sortVersions(version, other);
    }

    const parsedVersion = this._parse(version);
    const parsedOther = this._parse(other);

    if (parsedVersion === null || parsedOther === null) {
      if (parsedVersion === null && parsedOther === null) {
        return version.localeCompare(other);
      }
      return parsedVersion === null ? -1 : 1;
    }

    const versionReleases = parsedVersion.release;
    const otherReleases = parsedOther.release;

    const maxLength =
      versionReleases.length > otherReleases.length
        ? versionReleases.length
        : otherReleases.length;

    for (let i = 0; i < maxLength; i++) {
      const verVal = versionReleases[i];
      const otherVal = otherReleases[i];

      if (
        verVal !== undefined &&
        otherVal !== undefined &&
        verVal !== otherVal
      ) {
        return verVal - otherVal;
      } else if (verVal === undefined) {
        return 1;
      } else if (otherVal === undefined) {
        return -1;
      }
    }

    return 0;
  }

  override matches(version: string, range: string): boolean {
    return this.equals(version, range);
  }
}

export const api: VersioningApiConstructor = HermitVersioning;
export const id = 'hermit';
export const displayName = 'Hermit';
export const urls = [
  'https://cashapp.github.io/hermit/packaging/reference/#versions',
];
export const supportsRanges = false;
