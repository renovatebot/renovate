import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'rpm';
export const displayName = 'RPM version';
export const urls = [
  'https://docs.fedoraproject.org/en-US/packaging-guidelines/Versioning/',
  'https://fedoraproject.org/wiki/Package_Versioning_Examples',
  'https://fedoraproject.org/wiki/User:Tibbs/TildeCaretVersioning',
];
export const supportsRanges = false;

const alphaNumPattern = regEx(/([a-zA-Z]+)|(\d+)|(~)/g);
const epochPattern = regEx(/^\d+$/);

export interface RpmVersion extends GenericVersion {
  /**
   * epoch, defaults to 0 if not present, are used to leave version mistakes and previous
   * versioning schemes behind.
   */
  epoch: number;
  /**
   * upstreamVersion is the main version part: it defines the version of origin software
   * that was packaged.
   */
  upstreamVersion: string;
  /**
   * rpmRelease is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  rpmRelease: string;

  /**
   * rpmPreRelease is used to distinguish versions of prerelease of the same upstream and release version
   * Example: Python 3.12.0-1 > Python 3.12.0-1~a1
   */
  rpmPreRelease: string;

  /**
   * snapshot is an archive taken from upstream's source code control system which is not equivalent to any release version.
   * This field must at minimum consist of the date in eight-digit "YYYYMMDD" format. The packager MAY
   * include up to 17 characters of additional information after the date. The following formats are suggested:
   * YYYYMMDD.<revision>
   * YYYYMMDD<scm><revision>
   */
  snapshot: string;
}

class RpmVersioningApi extends GenericVersioningApi {
  /**
   * https://github.com/rpm-software-management/rpm/blob/e3c11a790367016aed7ea48cfcc78751a71ce862/rpmio/rpmvercmp.c#L16
   */
  protected _parse(version: string): RpmVersion | null {
    let remainingVersion = version;

    let epoch = 0;
    const epochIndex = remainingVersion.indexOf(':');
    if (epochIndex !== -1) {
      const epochStr = remainingVersion.slice(0, epochIndex);
      if (epochPattern.test(epochStr)) {
        epoch = parseInt(epochStr);
      } else {
        return null;
      }

      remainingVersion = remainingVersion.slice(epochIndex + 1);
    }

    let upstreamVersion: string;
    let rpmRelease = '';
    let rpmPreRelease = '';
    let snapshot = '';
    const releaseIndex = remainingVersion.indexOf('-');
    const prereleaseIndex = remainingVersion.indexOf('~');

    // Note: There can be a snapshot if there is no prerelease. Snapshot always beat no snapshot,
    // so if there is 3.12.0-1 vs 3.12.0-1^20231110, the snapshot wins.
    // The logic below only creates snapshot IF there is a prerleease version. This logic is NOT
    // correct, but the result is still correct due to the caret being ignored in release, and
    // release continue comparing
    //
    // Note: If there IS a tilde preceding the caret, then snapshot DOES NOT win
    // Example: 3.12.0-1~^20231001 LOSES to 3.12.0-1 and
    // 3.12.0-1~^20231001 LOSES to 3.12.0-1^20231001
    const snapshotIndex = remainingVersion.indexOf('^');

    if (releaseIndex >= 0) {
      upstreamVersion = remainingVersion.slice(0, releaseIndex);

      // Do NOT splice out prerelease, we need to distinguish if the flag is set or not, regardless if there is a version.
      // The tilde will get filtered out during regex
      if (prereleaseIndex >= 0) {
        rpmRelease = remainingVersion.slice(releaseIndex, prereleaseIndex);
        if (snapshotIndex >= 0) {
          rpmPreRelease = remainingVersion.slice(
            prereleaseIndex,
            snapshotIndex,
          );
          snapshot = remainingVersion.slice(snapshotIndex + 1);
        } else {
          rpmPreRelease = remainingVersion.slice(prereleaseIndex);
        }
      } else {
        rpmRelease = remainingVersion.slice(releaseIndex + 1);
      }
    } else {
      upstreamVersion = remainingVersion;
    }

    const release = [...remainingVersion.matchAll(regEx(/\d+/g))].map((m) =>
      parseInt(m[0]),
    );

    return {
      epoch,
      upstreamVersion,
      rpmRelease,
      release,
      rpmPreRelease,
      snapshot,
    };
  }

  protected _compare_string(s1: string, s2: string): number {
    if (s1 === s2) {
      return 0;
    }

    const minLength = Math.min(s1.length, s2.length);

    for (let i = 0; i < minLength; i++) {
      const c1 = s1[i];
      const c2 = s2[i];

      if (c1 === c2) {
        continue;
      }

      if (c1 > c2) {
        return 1;
      } else if (c1 < c2) {
        return -1;
      }
    }

    // Okay, they've been the exact same up until now, so return the longer one
    return s1.length > s2.length ? 1 : -1;
  }

  /**
   * Taken from https://github.com/rpm-software-management/rpm/blob/master/rpmio/rpmvercmp.c
   */
  protected _compare_glob(v1: string, v2: string): number {
    if (v1 === v2) {
      return 0;
    }

    const matchesv1 = v1.match(alphaNumPattern) ?? [];
    const matchesv2 = v2.match(alphaNumPattern) ?? [];
    const matches = Math.min(matchesv1.length, matchesv2.length);

    for (let i = 0; i < matches; i++) {
      const matchv1 = matchesv1[i];
      const matchv2 = matchesv2[i];

      // compare tildes
      if (matchv1?.startsWith('~') || matchv2?.startsWith('~')) {
        if (!matchv1?.startsWith('~')) {
          return 1;
        }

        if (!matchv2?.startsWith('~')) {
          return -1;
        }
      }

      if (is.numericString(matchv1?.[0])) {
        // numbers are greater than letters
        if (!is.numericString(matchv2?.[0])) {
          return 1;
        }

        //We clearly have a number here, so return which is greater
        const result = matchv1.localeCompare(matchv2, undefined, {
          numeric: true,
        });

        if (result === 0) {
          continue;
        }

        return Math.sign(result);
      } else if (is.numericString(matchv2?.[0])) {
        return -1;
      }

      // We have two string globs, compare them
      const compared_value = this._compare_string(matchv1, matchv2);
      if (compared_value !== 0) {
        return compared_value;
      }
    }

    // segments were all the same, but separators were different
    if (matchesv1.length === matchesv2.length) {
      return 0;
    }

    // If there is a tilde in a segment past the minimum number of segments, find it
    if (matchesv1.length > matches && matchesv1[matches].startsWith('~')) {
      return -1;
    }

    if (matchesv2.length > matches && matchesv2[matches].startsWith('~')) {
      return 1;
    }

    // whichever has the most segments wins
    return matchesv1.length > matchesv2.length ? 1 : -1;
  }

  protected override _compare(version: string, other: string): number {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);

    if (!(parsed1 && parsed2)) {
      return 1;
    }

    // Greater epoch wins
    if (parsed1.epoch !== parsed2.epoch) {
      return Math.sign(parsed1.epoch - parsed2.epoch);
    }

    // Greater upstream version wins
    const upstreamVersionDifference = this._compare_glob(
      parsed1.upstreamVersion,
      parsed2.upstreamVersion,
    );

    if (upstreamVersionDifference !== 0) {
      return upstreamVersionDifference;
    }

    // Greater release version wins
    const releaseVersionDifference = this._compare_glob(
      parsed1.rpmRelease,
      parsed2.rpmRelease,
    );

    if (releaseVersionDifference !== 0) {
      return releaseVersionDifference;
    }

    // No Prerelease wins
    if (parsed1.rpmPreRelease === '' && parsed2.rpmPreRelease !== '') {
      return 1;
    } else if (parsed1.rpmPreRelease !== '' && parsed2.rpmPreRelease === '') {
      return -1;
    }

    const preReleaseDifference = this._compare_glob(
      parsed1.rpmPreRelease,
      parsed2.rpmPreRelease,
    );

    if (preReleaseDifference !== 0) {
      return releaseVersionDifference;
    }

    // Greater Snapshot wins
    return this._compare_glob(parsed1.snapshot, parsed2.snapshot);
  }
}

export const api: VersioningApi = new RpmVersioningApi();

export default api;
