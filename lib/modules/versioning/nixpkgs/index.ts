import {
  isEmptyArray,
  isNonEmptyArray,
  isNonEmptyStringAndNotWhitespace,
} from '@sindresorhus/is';
import type { RegExpVersion } from '../regex';
import { RegExpVersioningApi } from '../regex';
import type { VersioningApiConstructor } from '../types';

export const id = 'nixpkgs';
export const displayName = 'Nixpkgs';
export const urls = ['https://github.com/NixOS/nixpkgs'];
export const supportsRanges = false;

export class NixPkgsVersioning extends RegExpVersioningApi {
  private static readonly versionRegex =
    '^(?<prefix>(nixos|nixpkgs|release))-((?<major>\\d{2})\\.(?<minor>\\d{2})|unstable)(-(?<suffix>(small|aarch64|darwin)))?$';

  constructor() {
    super(NixPkgsVersioning.versionRegex);
  }

  protected override _parse(version: string): RegExpVersion | null {
    const groups = this._config?.exec(version)?.groups;

    if (!groups) {
      return null;
    }

    const { prefix, major, minor, suffix } = groups;
    const release = [];

    if (major) {
      release.push(Number.parseInt(major));
    }

    if (minor) {
      release.push(Number.parseInt(minor));
    }

    const compatibility = isNonEmptyStringAndNotWhitespace(suffix)
      ? `${prefix}-${suffix}`
      : prefix;

    return {
      release,
      compatibility,
    };
  }

  override isStable(version: string): boolean {
    const parsed = this._parse(version);
    return isNonEmptyArray(parsed?.release);
  }

  protected override _compare(version: string, other: string): number {
    const left = this._parse(version);
    const right = this._parse(other);

    // empty version is equal to 'unstable'
    if (isEmptyArray(left?.release) && isEmptyArray(right?.release)) {
      return 0;
    }
    if (isEmptyArray(left?.release)) {
      return 1;
    }
    if (isEmptyArray(right?.release)) {
      return -1;
    }
    return super._compare(version, other);
  }
}

export const api: VersioningApiConstructor = NixPkgsVersioning;

export default api;
