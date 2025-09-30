import { regEx } from '../../../util/regex';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'apk';
export const displayName = 'Alpine Package Keeper (APK)';
export const urls = [
  'https://wiki.alpinelinux.org/wiki/Package_policies',
  'https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper#Package_pinning',
];
export const supportsRanges = false;

export interface ApkVersion extends GenericVersion {
  /**
   * version is the main version part: it defines the version of origin software
   * that was packaged.
   */
  version: string;
  /**
   * releaseString is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  releaseString: string;
}

class ApkVersioningApi extends GenericVersioningApi {
  /**
   * Parse APK version format using apko's version parsing patterns
   * Based on: https://github.com/chainguard-dev/apko/blob/main/pkg/apk/apk/version.go
   *
   */
  protected _parse(version: string): ApkVersion | null {
    // Enhanced regex based on Go pattern but more flexible for complex prerelease identifiers
    // Groups: 1=major, 2=minor.patch, 3=letter, 4=prerelease_full, 5=package_fix_full, 6=release_full, 7=release_num
    // Regex from https://github.com/chainguard-dev/apko/blob/main/pkg/apk/apk/version.go
    const versionRegex = regEx(
      /^v?([0-9]+)((\.[0-9]+)*)([a-z]?)((_[a-z]+(?:_[a-z]+)*[0-9]*))?((_cvs|_svn|_git|_hg|_p)([0-9]*))?((-r)([0-9]+))?$/,
    );
    const match = versionRegex.exec(version);

    if (!match) {
      return null;
    }

    const [
      ,
      major,
      minorPatch,
      ,
      letter,
      prereleaseFull,
      packageFixFull,
      releaseNum,
    ] = match;

    // Build the full version string
    const versionStr =
      major +
      (minorPatch || '') +
      (letter || '') +
      (prereleaseFull || '') +
      (packageFixFull || '');

    // Extract prerelease identifier if present
    let prerelease: string | undefined;
    if (prereleaseFull) {
      const identifier = prereleaseFull.substring(1); // Remove leading _
      // Only treat as prerelease if it's not a package fix or special pattern
      if (
        !['p', 'cvs', 'git', 'svn', 'hg'].some((prefix) =>
          identifier.startsWith(prefix),
        )
      ) {
        prerelease = identifier;
      }
    }

    // Extract numeric parts for major/minor/patch
    const release = [parseInt(major)];
    if (minorPatch) {
      const minorPatchParts = minorPatch.substring(1).split('.').map(Number);
      release.push(...minorPatchParts);
    }

    return {
      version: versionStr,
      releaseString: releaseNum || '',
      release,
      prerelease,
    };
  }

  /**
   * Compare two APK versions according to Alpine Linux rules
   * 1. Compare version parts
   * 2. Compare release parts
   */
  protected override _compare(version: string, other: string): number {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);

    if (!(parsed1 && parsed2)) {
      return 1;
    }

    // Compare version parts
    const versionCompare = this._compareVersionParts(
      parsed1.version,
      parsed2.version,
    );
    if (versionCompare !== 0) {
      return versionCompare;
    }

    // If version parts are the same, compare prerelease identifiers
    if (parsed1.prerelease || parsed2.prerelease) {
      if (!parsed1.prerelease) {
        return 1; // Stable version is greater than prerelease
      }
      if (!parsed2.prerelease) {
        return -1; // Prerelease version is less than stable
      }
      // Both have prerelease identifiers, compare them
      const prereleaseCompare = parsed1.prerelease.localeCompare(
        parsed2.prerelease,
      );
      if (prereleaseCompare !== 0) {
        return prereleaseCompare;
      }
    }

    // Compare release parts
    return this._compareVersionParts(
      parsed1.releaseString,
      parsed2.releaseString,
    );
  }

  /**
   * Compare version parts using APK's version comparison rules
   * Simplified version that handles APK-specific patterns
   */
  private _compareVersionParts(v1: string, v2: string): number {
    if (v1 === v2) {
      return 0;
    }

    const alphaNumPattern = regEx(/([a-zA-Z]+)|(\d+)/g);
    const matchesv1 = v1.match(alphaNumPattern) ?? [];
    const matchesv2 = v2.match(alphaNumPattern) ?? [];
    const matches = Math.min(matchesv1.length, matchesv2.length);

    for (let i = 0; i < matches; i++) {
      const matchv1 = matchesv1[i];
      const matchv2 = matchesv2[i];

      // Compare numbers vs strings
      if (matchv1 && /^\d+$/.test(matchv1)) {
        if (!matchv2 || !/^\d+$/.test(matchv2)) {
          return 1; // numbers are greater than letters
        }
        const num1 = parseInt(matchv1);
        const num2 = parseInt(matchv2);
        if (num1 !== num2) {
          return num1 - num2;
        }
      } else if (matchv2 && /^\d+$/.test(matchv2)) {
        return -1; // letters are less than numbers
      } else {
        // Both are strings, compare lexicographically
        if (matchv1 !== matchv2) {
          return matchv1.localeCompare(matchv2);
        }
      }
    }

    // whichever has the most segments wins
    return matchesv1.length > matchesv2.length ? 1 : -1;
  }

  override isValid(version: string): boolean {
    const parsed = this._parse(version);
    if (!parsed) {
      return false;
    }
    // APK versions must start with a number
    return /^\d/.test(parsed.version);
  }

  override isStable(version: string): boolean {
    const parsed = this._parse(version);
    if (!parsed) {
      return false;
    }
    // Consider versions without prerelease identifiers as stable
    return !parsed.prerelease;
  }

  override getSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    // Handle range expressions like >5.2.37-r0, >=5.2.37-r0, etc.
    const rangeMatch = /^([><=~^]+)(.+)$/.exec(range);
    if (!rangeMatch) {
      // If no range operator, look for exact match
      return versions.find((v) => this.equals(v, range)) ?? null;
    }

    const [, operator, targetVersion] = rangeMatch;

    // Filter versions that satisfy the range
    const satisfyingVersions = versions.filter((version) => {
      if (!this.isValid(version) || !this.isValid(targetVersion)) {
        return false;
      }

      switch (operator) {
        case '>':
          return this.isGreaterThan(version, targetVersion);
        case '>=':
          return (
            this.isGreaterThan(version, targetVersion) ||
            this.equals(version, targetVersion)
          );
        case '<':
          return this.isLessThanRange(version, targetVersion);
        case '<=':
          return (
            this.isLessThanRange(version, targetVersion) ||
            this.equals(version, targetVersion)
          );
        case '=':
        case '==':
          return this.equals(version, targetVersion);
        case '~': {
          // Tilde range: allow patch-level changes if a minor version is specified
          const targetParsed = this._parse(targetVersion);
          const versionParsed = this._parse(version);
          if (!targetParsed || !versionParsed) {
            return false;
          }

          // Must have same major and minor versions
          if (
            targetParsed.release[0] !== versionParsed.release[0] ||
            targetParsed.release[1] !== versionParsed.release[1]
          ) {
            return false;
          }

          // Version must be >= target
          return (
            this.isGreaterThan(version, targetVersion) ||
            this.equals(version, targetVersion)
          );
        }
        case '^': {
          // Caret range: allow changes that do not modify the left-most non-zero digit
          const targetMajor = this.getMajor(targetVersion);
          const versionMajor = this.getMajor(version);
          if (targetMajor === null || versionMajor === null) {
            return false;
          }

          if (targetMajor === 0) {
            // For 0.x.x, allow patch and minor changes
            const targetMinor = this.getMinor(targetVersion);
            const versionMinor = this.getMinor(version);
            if (targetMinor === null || versionMinor === null) {
              return false;
            }

            return (
              targetMinor === versionMinor &&
              (this.isGreaterThan(version, targetVersion) ||
                this.equals(version, targetVersion))
            );
          } else {
            // For x.x.x where x > 0, allow minor and patch changes
            return (
              targetMajor === versionMajor &&
              (this.isGreaterThan(version, targetVersion) ||
                this.equals(version, targetVersion))
            );
          }
        }
        default:
          return false;
      }
    });

    if (satisfyingVersions.length === 0) {
      return null;
    }

    // Return the highest satisfying version
    return satisfyingVersions.sort((a, b) => this.sortVersions(b, a))[0];
  }

  override getMajor(version: string): number | null {
    const parsed = this._parse(version);
    return parsed?.release[0] ?? null;
  }

  override getMinor(version: string): number | null {
    const parsed = this._parse(version);
    return parsed?.release[1] ?? null;
  }

  override getPatch(version: string): number | null {
    const parsed = this._parse(version);
    if (!parsed || parsed.prerelease?.startsWith('p')) {
      return null;
    }
    return parsed.release[2] ?? null;
  }
}

export const api: VersioningApi = new ApkVersioningApi();

export default api;
