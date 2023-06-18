import { satisfies } from 'semver';
import { RegExpVersion, RegExpVersioningApi } from '../regex';
import type { VersioningApiConstructor } from '../types';

export const id = 'hermit';
export const displayName = 'Hermit';
export const urls = [
  'https://cashapp.github.io/hermit/packaging/reference/#versions',
];
export const supportsRanges = false;

export class HermitVersioning extends RegExpVersioningApi {
  // add <supplement> element to accomondate openjdk versioning defined in JEP322
  // https://openjdk.org/jeps/322
  static versionRegex =
    '^(?<major>\\d+)(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?(\\.(?<supplement>\\d+))?(_(?<build>\\d+))?([-]?(?<prerelease>[^.+][^+]*))?([+](?<compatibility>[^.-][^+]*))?$';

  public constructor() {
    super(HermitVersioning.versionRegex);
  }

  private _isValid(version: string): boolean {
    return super._parse(version) !== null;
  }

  private _parseHermitVersioning(version: string): RegExpVersion | null {
    const groups = this._config?.exec(version)?.groups;
    if (!groups) {
      return null;
    }

    const {
      major,
      minor,
      patch,
      supplement,
      build,
      prerelease,
      compatibility,
    } = groups;
    const release = [
      typeof major === 'undefined' ? 0 : Number.parseInt(major, 10),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor, 10),
      typeof patch === 'undefined' ? 0 : Number.parseInt(patch, 10),
      typeof supplement === 'undefined' ? 0 : Number.parseInt(supplement, 10),
    ];

    if (build) {
      release.push(Number.parseInt(build, 10));
    }

    return {
      release,
      prerelease,
      compatibility,
    };
  }

  protected override _parse(version: string): RegExpVersion | null {
    const parsed = this._parseHermitVersioning(version);
    if (parsed) {
      return parsed;
    }
    const channelVer = HermitVersioning._getChannel(version);

    const groups = this._config?.exec(channelVer)?.groups;

    if (!groups) {
      return null;
    }

    const {
      major,
      minor,
      patch,
      supplement,
      build,
      prerelease,
      compatibility,
    } = groups;
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
    if (supplement) {
      release.push(Number.parseInt(supplement, 10));
    }
    if (build) {
      release.push(Number.parseInt(build, 10));
    }

    return {
      release,
      prerelease,
      compatibility,
    };
  }

  private static _isChannel(version: string): boolean {
    return version.startsWith('@');
  }

  private static _getChannel(version: string): string {
    return version.substring(1);
  }

  override isStable(version: string): boolean {
    if (this._isValid(version)) {
      return super.isStable(version);
    }

    // channel and the rest should be considered unstable version
    // as channels are changing values
    return false;
  }

  override isValid(version: string): boolean {
    return this._isValid(version) || HermitVersioning._isChannel(version);
  }

  override isLessThanRange(version: string, range: string): boolean {
    return this._compare(version, range) < 0;
  }

  protected override _compare(version: string, other: string): number {
    if (this._isValid(version) && this._isValid(other)) {
      return super._compare(version, other);
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
    if (
      HermitVersioning._isChannel(version) ||
      HermitVersioning._isChannel(range)
    ) {
      return this.equals(version, range);
    }

    return satisfies(version, range);
  }
}

export const api: VersioningApiConstructor = HermitVersioning;

export default api;
