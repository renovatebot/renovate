import { regEx } from '../../../util/regex.ts';
import type { ParsedVersion } from './types.ts';

/**
 * Pattern source of the optional SemVer 2.0 prerelease and build metadata of a version,
 * with the named groups `prerelease` and `build`.
 */
export const suffixSource = String.raw`(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?<build>\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?`;

const versionPattern = regEx(
  String.raw`^[vV]?(?<release>\d+(?:\.\d+){2,9})${suffixSource}$`,
);
const numericPattern = regEx(/^\d+$/);

/**
 * Parses a version with three to ten numeric parts, an optional prerelease and optional build metadata.
 */
export function parseVersion(version: string): ParsedVersion | null {
  const matches = versionPattern.exec(version);
  if (!matches) {
    return null;
  }
  const { release, prerelease } = matches.groups!;
  return {
    releaseBig: release.split('.').map((part) => BigInt(part)),
    prerelease,
  };
}

/**
 * Compares two bigints and returns -1, 0 or 1.
 */
function compareBig(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * Compares two release part lists, treating missing parts as zero.
 */
export function compareRelease(left: bigint[], right: bigint[]): number {
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const result = compareBig(left[i] ?? 0n, right[i] ?? 0n);
    if (result !== 0) {
      return result;
    }
  }
  return 0;
}

/**
 * Compares two prerelease identifiers per SemVer 2.0 §11.4.
 */
function compareIdentifier(left: string, right: string): number {
  const leftNumeric = numericPattern.test(left);
  const rightNumeric = numericPattern.test(right);
  if (leftNumeric && rightNumeric) {
    return compareBig(BigInt(left), BigInt(right));
  }
  if (leftNumeric) {
    return -1;
  }
  if (rightNumeric) {
    return 1;
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * Compares two prereleases per SemVer 2.0 §11, where no prerelease ranks highest.
 */
function comparePrerelease(
  left: string | undefined,
  right: string | undefined,
): number {
  if (left === right) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }

  const leftIds = left.split('.');
  const rightIds = right.split('.');
  const length = Math.min(leftIds.length, rightIds.length);
  for (let i = 0; i < length; i += 1) {
    const result = compareIdentifier(leftIds[i], rightIds[i]);
    if (result !== 0) {
      return result;
    }
  }
  return leftIds.length - rightIds.length;
}

/**
 * Compares two parsed versions by release parts, then by prerelease.
 */
export function compareVersions(
  left: ParsedVersion,
  right: ParsedVersion,
): number {
  const result = compareRelease(left.releaseBig, right.releaseBig);
  if (result !== 0) {
    return result;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}
