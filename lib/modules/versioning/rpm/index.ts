import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'rpm';
export const displayName = 'RPM version';
export const urls = [
  'https://docs.fedoraproject.org/en-US/packaging-guidelines/Versioning/',
];
export const supportsRanges = false;

const alphaNumPattern = regEx(/(\w+)|(\d+)|(~)/g);
const epochPattern = regEx(/^\d+$/);
const leadingZerosPattern = regEx(/^0+/);

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
        epoch = parseInt(epochStr, 10);
      } else {
        return null;
      }

      remainingVersion = remainingVersion.slice(epochIndex + 1);
    }

    let upstreamVersion: string;
    let rpmRelease = '';
    const releaseIndex = remainingVersion.indexOf('-');
    if (releaseIndex >= 0) {
      upstreamVersion = remainingVersion.slice(0, releaseIndex);
      rpmRelease = remainingVersion.slice(releaseIndex + 1);
    } else {
      upstreamVersion = remainingVersion;
    }

    const release = [...remainingVersion.matchAll(regEx(/\d+/g))].map((m) =>
      parseInt(m[0], 10),
    );

    return {
      epoch,
      upstreamVersion,
      rpmRelease,
      release,
      suffix: rpmRelease,
    };
  }

  protected __compare_character(s1: any, s2: any): number {
    const matches = Math.min(s1?.length ?? 0, s2?.length ?? 0);

    for (let i = 0; i < matches; i++) {
      const c1 = s1[i];
      const c2 = s2[i];
      if (c1 === c2) {
        continue;
      }

      // Numbers are bigger than characters
      // Because c1 is a number, it is bigger
      else if (is.numericString(c1) && !is.numericString(c2)) {
        return 1;
      }
      // Because c2 is a number, it is bigger
      else if (!isNaN(c1) && isNaN(c2)) {
        return -1;
      }

      // Okay, they're the same type (aka alpha && alpha, or num && num)
      // Let's continue with the regular compare
      if ((c1 ?? '') > (c2 ?? '')) {
        return 1;
      } else if ((c1 ?? '') < (c2 ?? '')) {
        return -1;
      }
    }

    if (s1.length === s2.length) {
      return 0;
    }

    // Okay, they've been the exact same up until now, so return the longer one
    return s1.length > s2.length ? 1 : -1;
  }

  /**
   * Taken from https://github.com/rpm-software-management/rpm/blob/master/rpmio/rpmvercmp.c
   */
  protected _compare_string(v1: string, v2: string): number {
    if (v1 === v2) {
      return 0;
    }

    const matchesv1 = v1.match(alphaNumPattern);
    const matchesv2 = v2.match(alphaNumPattern);
    const matches = Math.min(matchesv1?.length ?? 0, matchesv2?.length ?? 0);

    for (let i = 0; i < matches; i++) {
      let matchv1 = matchesv1?.[i];
      let matchv2 = matchesv2?.[i];

      // compare tildes
      if (matchv1?.[0] === '~' || matchv2?.[0] === '~') {
        if (matchv1?.[0] !== '~') {
          return 1;
        }

        if (matchv2?.[0] === '~') {
          return -1;
        }
      }

      if (is.numericString(matchv1?.[0])) {
        // numbers are greater than letters
        if (!is.numericString(matchv2?.[0])) {
          return 1;
        }

        // trim leading zeros
        matchv1 = matchv1?.replace(leadingZerosPattern, '');
        matchv2 = matchv2?.replace(leadingZerosPattern, '');

        // longest string wins without further comparison
        if ((matchv1?.length ?? 0) > (matchv2?.length ?? 0)) {
          return 1;
        }

        if ((matchv1?.length ?? 0) < (matchv2?.length ?? 0)) {
          return -1;
        }
      } else if (is.numericString(matchv2?.[0])) {
        return -1;
      }

      // string compare
      const compared_value = this.__compare_character(matchv1, matchv2);
      if (compared_value !== 0) {
        return compared_value;
      }
    }

    // segments were all the same, but separators were different
    if ((matchesv1?.length ?? 0) === (matchesv2?.length ?? 0)) {
      return 0;
    }

    // If there is a tilde in a segment past the minimum number of segments, find it
    if ((matchesv1?.length ?? 0) > matches && matchesv1?.[matches][0] === '~') {
      return -1;
    }

    if ((matchesv2?.length ?? 0) > matches && matchesv2?.[matches][0] === '~') {
      return 1;
    }

    // whichever has the most segments wins
    return (matchesv1?.length ?? 0) > (matchesv2?.length ?? 0) ? 1 : -1;
  }

  protected override _compare(version: string, other: string): number {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);
    if (!(parsed1 && parsed2)) {
      return 1;
    }
    if (parsed1.epoch !== parsed2.epoch) {
      return Math.sign(parsed1.epoch - parsed2.epoch);
    }
    const upstreamVersionDifference = this._compare_string(
      parsed1.upstreamVersion,
      parsed2.upstreamVersion,
    );
    if (upstreamVersionDifference !== 0) {
      return upstreamVersionDifference;
    }
    return this._compare_string(parsed1.rpmRelease, parsed2.rpmRelease);
  }
}

export const api: VersioningApi = new RpmVersioningApi();

export default api;
