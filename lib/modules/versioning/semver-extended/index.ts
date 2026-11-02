import { regEx } from '../../../util/regex.ts';
import { GenericVersioningApi } from '../generic.ts';
import type { GenericVersion, VersioningApi } from '../types.ts';

export const id = 'semver-extended';
export const displayName = 'Semver Extended';
export const urls = ['[Semantic Versioning](https://semver.org/)'];
export const supportsRanges = false;

const versionPattern = regEx(
  /^[vV]?(?<release>\d+(?:\.\d+){2,9})(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/,
);
const numericPattern = regEx(/^\d+$/);

const sectionIndexes = {
  major: 0,
  minor: 1,
  patch: 2,
} as const;

interface SemverExtendedVersion extends GenericVersion {
  /** Release parts as bigints */
  releaseBig: bigint[];
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
function compareRelease(left: bigint[], right: bigint[]): number {
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

class SemverExtendedVersioningApi extends GenericVersioningApi<SemverExtendedVersion> {
  protected _parse(version: string): SemverExtendedVersion | null {
    const matches = versionPattern.exec(version);
    if (!matches) {
      return null;
    }
    const { release, prerelease } = matches.groups!;
    const releaseBig = release.split('.').map((part) => BigInt(part));
    return {
      release: releaseBig.map(Number),
      releaseBig,
      prerelease,
    };
  }

  protected override _compare(version: string, other: string): number {
    const left = this._parse(version);
    const right = this._parse(other);
    if (!(left && right)) {
      return 1;
    }

    const result = compareRelease(left.releaseBig, right.releaseBig);
    if (result !== 0) {
      return result;
    }
    return comparePrerelease(left.prerelease, right.prerelease);
  }

  /**
   * Returns whether the major, minor or patch part of both versions is equal, compared as bigints.
   */
  override isSame(
    type: keyof typeof sectionIndexes,
    a: string,
    b: string,
  ): boolean {
    const parsedA = this._parse(a);
    const parsedB = this._parse(b);
    if (!(parsedA && parsedB)) {
      return false;
    }

    const sectionIndex = sectionIndexes[type];
    return (
      parsedA.releaseBig[sectionIndex] === parsedB.releaseBig[sectionIndex]
    );
  }

  /**
   * Returns whether an update from `current` to `version` may be breaking:
   * any update with a prerelease or an invalid version, any update from a
   * first part of zero, and any change of the first part.
   */
  isBreaking(current: string, version: string): boolean {
    if (!(this.isStable(current) && this.isStable(version))) {
      return true;
    }
    const currentMajor = this._parse(current)!.releaseBig[0];
    if (currentMajor === 0n) {
      return true;
    }
    return currentMajor !== this._parse(version)!.releaseBig[0];
  }
}

export const api: VersioningApi = new SemverExtendedVersioningApi();

export default api;
