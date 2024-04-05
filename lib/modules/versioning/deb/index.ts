import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'deb';
export const displayName = 'Deb version';
export const urls = [
  'https://www.debian.org/doc/debian-policy/ch-controlfields.html#version',
  'https://manpages.debian.org/unstable/dpkg-dev/deb-version.7.en.html',
];
export const supportsRanges = false;

const epochPattern = regEx(/^\d+$/);
const upstreamVersionPattern = regEx(/^[-+.:~A-Za-z\d]+$/);
const debianRevisionPattern = regEx(/^[+.~A-Za-z\d]*$/);
const numericPattern = regEx(/\d+/g);
const characterOrder =
  '~ ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-.:';
const numericChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface DebVersion extends GenericVersion {
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
   * debianRevision is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  debianRevision: string;
}

class DebVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): DebVersion | null {
    /* Splitting version into "[epoch:]upstream-version[-debian-revision]"
       All found numbers are exported as release info */

    // split of first element by `:` as epoch:
    const epochSplit = version.split(':');
    const epochStr = epochSplit.length > 1 ? epochSplit.shift()! : '0';
    const remainingVersion = epochSplit.join(':');

    // split of last element by `-`
    if (remainingVersion.endsWith('-')) {
      // Forbid debian revision (it would result in `2.4.0-` == `2.4.0`)
      return null;
    }
    const debianSplit = remainingVersion.split('-');
    const debianRevision = debianSplit.length > 1 ? debianSplit.pop()! : '';
    const upstreamVersion = debianSplit.join('-');

    if (
      !epochPattern.test(epochStr) ||
      !upstreamVersionPattern.test(upstreamVersion) ||
      !debianRevisionPattern.test(debianRevision)
    ) {
      return null;
    }
    const release = [...remainingVersion.matchAll(numericPattern)].map((m) =>
      parseInt(m[0], 10),
    );
    return {
      epoch: parseInt(epochStr, 10),
      upstreamVersion,
      debianRevision,
      release,
      suffix: debianRevision,
    };
  }

  protected _compare_string(a: string, b: string): number {
    /* Special string sorting based on official specification:
     * https://manpages.debian.org/unstable/dpkg-dev/deb-version.7.en.html#Sorting_algorithm
     * The string is compared by continuous blocks of a) non-digit and b) digit characters.
     * Non-digit blocks are compared lexicographically with a custom character order.
     * Digit blocks are compared numerically.
     * We are alternating between both modes until a difference is found.
     */
    let charPos = 0;
    while (charPos < a.length || charPos < b.length) {
      const aChar = a.charAt(charPos);
      const bChar = b.charAt(charPos);
      if (numericChars.includes(aChar) && numericChars.includes(bChar)) {
        // numeric comparison of the whole block
        let aNumericEnd = charPos + 1;
        while (numericChars.includes(a.charAt(aNumericEnd))) {
          aNumericEnd += 1;
        }
        let bNumericEnd = charPos + 1;
        while (numericChars.includes(b.charAt(bNumericEnd))) {
          bNumericEnd += 1;
        }
        const numericCmp = a
          .substring(charPos, aNumericEnd)
          .localeCompare(b.substring(charPos, bNumericEnd), undefined, {
            numeric: true,
          });
        if (numericCmp !== 0) {
          return numericCmp;
        }
        charPos = aNumericEnd; // the same as bNumericEnd as both are the same
        continue;
      }
      if (aChar !== bChar) {
        // Lexicographical comparison
        // numeric character is treated like end of string (they are part of a new block)
        const aPriority = characterOrder.indexOf(
          numericChars.includes(aChar) || aChar === '' ? ' ' : aChar,
        );
        const bPriority = characterOrder.indexOf(
          numericChars.includes(bChar) || bChar === '' ? ' ' : bChar,
        );
        return Math.sign(aPriority - bPriority);
      }
      charPos += 1;
    }
    return 0;
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
    return this._compare_string(parsed1.debianRevision, parsed2.debianRevision);
  }
}

export const api: VersioningApi = new DebVersioningApi();

export default api;
