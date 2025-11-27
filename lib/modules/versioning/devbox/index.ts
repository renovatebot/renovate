import { regEx } from '../../../util/regex';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'devbox';
export const displayName = 'devbox';
export const urls = [];
export const supportsRanges = false;

const validPattern = regEx(/^((\d|[1-9]\d*)(\.(\d|[1-9]\d*)){0,2})(.+)?$/);
const versionPattern = regEx(/^((\d|[1-9]\d*)(\.(\d|[1-9]\d*)){2})(.+)?$/);
const stablePattern = regEx(/^((\d|[1-9]\d*)(\.(\d|[1-9]\d*)){2})(\+.+)?$/);
const prereleasePattern = regEx(/^[-+.]?(a|alpha|b|beta|rc|c)?(\d+)?(.*)$/);
const rangeOperatorPattern = regEx(/^[~>^]/);

const preReleaseOrder: Record<string, number> = {
  a: 1,
  alpha: 1,
  b: 2,
  beta: 2,
  rc: 3,
  c: 3,
};

class DevboxVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    const matches = validPattern.exec(version);
    if (!matches) {
      return null;
    }
    // Extract only the numeric part (matches[1]) before any suffix
    const release = matches[1].split('.').map(Number);
    return { release };
  }

  private _getSuffix(version: string): string {
    const matches = validPattern.exec(version);
    return matches?.[5] ?? '';
  }

  private _parsePreRelease(suffix: string): {
    type: string;
    order: number;
    num: number;
    rest: string;
    isPreRelease: boolean;
  } {
    // Match patterns like: -alpha1, a1, rc3, +8, -beta.3, .5
    // This regex always matches due to all-optional groups and trailing (.*)
    const match = prereleasePattern.exec(suffix)!;
    const type = match[1] || '';
    const num = match[2] ? parseInt(match[2]) : 0;
    const rest = match[3] || '';

    // + prefix means build metadata (treated as higher than no suffix)
    if (suffix.startsWith('+')) {
      return { type: 'build', order: 1000, num, rest, isPreRelease: false };
    }

    // Check if this is a recognized pre-release identifier
    const isPreRelease = type in preReleaseOrder;
    const order = isPreRelease ? preReleaseOrder[type] : 999;

    return { type, order, num, rest, isPreRelease };
  }

  private _compareSuffixes(suffix1: string, suffix2: string): number {
    // Extract pre-release type and number from suffixes
    const pre1 = this._parsePreRelease(suffix1);
    const pre2 = this._parsePreRelease(suffix2);

    // Handle comparison with no suffix (base version)
    if (!suffix1) {
      return pre2.isPreRelease ? 1 : -1; // base > pre-release, base < other
    }
    if (!suffix2) {
      return pre1.isPreRelease ? -1 : 1; // pre-release < base, other > base
    }

    // Compare pre-release order (a < b < rc)
    if (pre1.order !== pre2.order) {
      return pre1.order - pre2.order;
    }

    // Same pre-release type, compare numbers
    if (pre1.num !== pre2.num) {
      return pre1.num - pre2.num;
    }

    // If there's more to compare, do lexicographic comparison
    if (pre1.rest || pre2.rest) {
      return pre1.rest.localeCompare(pre2.rest);
    }

    return 0;
  }

  private _hasLeadingZero(version: string): boolean {
    // Check for leading zeros in any numeric part
    // Extract just the numeric version part before any suffix
    const numericPart = version.split(/[-+]/)[0];
    const parts = numericPart.split('.');
    for (const part of parts) {
      if (part.length > 1 && part.startsWith('0')) {
        return true;
      }
    }
    return false;
  }

  override isValid(version: string): boolean {
    if (version === 'latest') {
      return true;
    }
    // Reject versions starting with ~, >, or ^
    if (rangeOperatorPattern.test(version)) {
      return false;
    }
    // Reject versions with leading zeros
    if (this._hasLeadingZero(version)) {
      return false;
    }
    // Reject versions with empty suffixes (e.g., '1.2.3-', '1.2.3.')
    if (regEx(/[-+.]$/).test(version)) {
      return false;
    }
    return this._parse(version) !== null;
  }

  override isVersion(version: string): boolean {
    if (version === 'latest') {
      return false;
    }
    // Reject versions with empty suffixes (e.g., '1.2.3-', '1.2.3.')
    if (regEx(/[-+.]$/).test(version)) {
      return false;
    }
    // Reject versions with leading zeros
    if (this._hasLeadingZero(version)) {
      return false;
    }
    const matches = versionPattern.exec(version);
    return !!matches;
  }

  override isStable(version: string): boolean {
    const matches = stablePattern.exec(version);
    return !!matches;
  }

  override matches(version: string, range: string): boolean {
    if (range === 'latest') {
      return this.isVersion(version);
    }
    return this.isVersion(version) && this.equals(version, range);
  }

  protected override _compare(version: string, other: string): number {
    // If version is "latest", it never equals anything (even itself)
    if (version === 'latest') {
      return 1;
    }

    // If other (range) is "latest", any valid version equals it
    if (other === 'latest') {
      return 0;
    }

    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);

    // If either version is invalid, return unequal
    if (!(parsed1 && parsed2)) {
      return 1;
    }
    // support variable length compare
    const length = Math.max(parsed1.release.length, parsed2.release.length);
    for (let i = 0; i < length; i += 1) {
      // 2.1 and 2.1.0 are equivalent
      const part1 = parsed1.release[i];
      const part2 = parsed2.release[i];
      // if part1 or part2 is undefined, we should treat them as equal
      // e.g. 1.0.0 === 1.0
      if (part1 !== undefined && part2 !== undefined && part1 !== part2) {
        return part1 - part2;
      }
    }

    // If numeric parts are equal, compare suffixes using PEP 440 ordering
    const suffix1 = this._getSuffix(version);
    const suffix2 = this._getSuffix(other);

    if (suffix1 !== suffix2) {
      return this._compareSuffixes(suffix1, suffix2);
    }

    return 0;
  }
}

export const api: VersioningApi = new DevboxVersioningApi();

export default api;
