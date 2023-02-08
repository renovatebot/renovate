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

const upstreamVersionPattern = regEx(/^[-+.:~A-Za-z0-9]+$/);
const debianRevisionPattern = regEx(/^[+.~A-Za-z0-9]*$/);
const numericPattern = regEx(/[0-9]+/g);
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
   * debianRevsion is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  debianRevision: string;
}

class DebVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): DebVersion | null {
    /* Splitting version into "[epoch:]upstream-version[-debian-revision]"
       All found numbers are exported as release info */
    let epoch = 0;
    let nonEpochVersion = version;
    if (nonEpochVersion.includes(':')) {
      const epochEnd = nonEpochVersion.indexOf(':');
      epoch = Number(nonEpochVersion.substring(0, epochEnd));
      if (!Number.isInteger(epoch)) {
        return null;
      }
      nonEpochVersion = nonEpochVersion.substring(epochEnd + 1);
    }

    let debianRevision = '';
    let upstreamVersion;
    if (nonEpochVersion.includes('-')) {
      const revisionStart = nonEpochVersion.lastIndexOf('-');
      debianRevision = nonEpochVersion.substring(revisionStart + 1);
      upstreamVersion = nonEpochVersion.substring(0, revisionStart);
    } else {
      upstreamVersion = nonEpochVersion;
    }

    if (
      !upstreamVersionPattern.test(upstreamVersion) ||
      !debianRevisionPattern.test(debianRevision)
    ) {
      return null;
    }
    const release = [...nonEpochVersion.matchAll(numericPattern)].map((m) =>
      Number(m[0])
    );
    return {
      epoch,
      upstreamVersion,
      debianRevision,
      release,
      suffix: debianRevision,
    };
  }

  protected _compare_string(a: string, b: string): number {
    /* The string is compared by continuous blocks of a) non-digit and b) digit characters.
       Non-digit blocks are compared lexicographically with a custom character order.
       Digit blocks are compared numerically.
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
          numericChars.includes(aChar) || aChar === '' ? ' ' : aChar
        );
        const bPriority = characterOrder.indexOf(
          numericChars.includes(bChar) || bChar === '' ? ' ' : bChar
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
    // istanbul ignore if
    if (!(parsed1 && parsed2)) {
      return 1;
    }
    if (parsed1.epoch !== parsed2.epoch) {
      return Math.sign(parsed1.epoch - parsed2.epoch);
    }
    const upstreamVersionDifference = this._compare_string(
      parsed1.upstreamVersion,
      parsed2.upstreamVersion
    );
    if (upstreamVersionDifference !== 0) {
      return upstreamVersionDifference;
    }
    return this._compare_string(parsed1.debianRevision, parsed2.debianRevision);
  }
}

export const api: VersioningApi = new DebVersioningApi();

export default api;
