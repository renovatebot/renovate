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
   */
  protected _parse(version: string): ApkVersion | null {
    // Original Go regex pattern from apko
    // Groups: 1=major, 2=minor.patch, 3=unused, 4=letter, 5=prerelease_type, 6=prerelease_num, 7=package_fix_type, 8=package_fix_num, 9=release_prefix, 10=release_num
    // Regex from https://github.com/chainguard-dev/apko/blob/main/pkg/apk/apk/version.go
    const versionRegex = regEx(
      /^v?([0-9]+)((\.[0-9]+)*)([a-z]?)((_alpha|_beta|_pre|_rc)([0-9]*))?((_cvs|_svn|_git|_hg|_p)([0-9]*))?((-r)([0-9]+))?$/,
    );

    // /^v?([0-9]+)((\.[0-9]+)*)([a-z]?)((_alpha|_beta|_pre|_rc)([0-9]*))?((_cvs|_svn|_git|_hg|_p)([0-9]*))?((-r)([0-9]+))?$/
    //  ^1^    ^2^^^^^^^^^^^ ^3^      ^4^      ^5^              ^6^        ^7^              ^8^        ^9^^ ^10^
    //  |      |             |        |        |                |          |                |          |    |
    //  |      |             |        |        |                |          |                |          |    └─ Release number (used)
    //  |      |             |        |        |                |          |                |          └─ Release prefix (unused - needed for ? quantifier)
    //  |      |             |        |        |                |          |                └─ Package fix number (used)
    //  |      |             |        |        |                |          └─ Package fix type (used)
    //  |      |             |        |        |                └─ Prerelease number (used)
    //  |      |             |        |        └─ Prerelease type (used)
    //  |      |             |        └─ Letter (used)
    //  |      |             └─ Inner repetition group (unused - needed for * quantifier)
    //  |      └─ Minor.patch (used)
    //  └─ Major (used)
    //
    // Note: Groups 3 and 9 are "unused" in destructuring but required for the regex to work:
    // - Group 3: Inner group needed for the * quantifier to repeat the full \.[0-9]+ pattern
    // - Group 9: Outer group needed for the ? quantifier to make the entire -r[0-9]+ optional
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
      ,
      prereleaseType,
      prereleaseNum,
      packageFixType,
      packageFixNum,
      ,
      ,
      ,
      releaseNum,
    ] = match;

    // Build the full version string (without release number and prerelease)
    /* v8 ignore next 3 -- defensive fallback for optional regex groups */
    const packageFixFull = packageFixType
      ? packageFixType + (packageFixNum || '')
      : '';

    // For version comparison, we only include the base version + package fix, not prerelease
    /* v8 ignore next 2 -- defensive fallback for optional regex groups */
    const versionStr =
      major + (minorPatch || '') + (letter || '') + (packageFixFull || '');

    // Extract prerelease identifier if present
    let prerelease: string | undefined;
    if (prereleaseType) {
      prerelease = prereleaseType.substring(1) + (prereleaseNum || '');
    }

    // Extract numeric parts for major/minor/patch
    const release = [parseInt(major)];
    if (minorPatch) {
      const minorPatchParts = minorPatch.substring(1).split('.').map(Number);
      release.push(...minorPatchParts);
    }

    // Extract release string (just the number part)
    const releaseString = releaseNum || '';

    return {
      version: versionStr,
      releaseString,
      release,
      prerelease,
    };
  }

  /**
   * Compare two APK versions according to Alpine Linux rules
   */
  protected override _compare(version: string, other: string): number {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);

    if (!(parsed1 && parsed2)) {
      return 1;
    }

    // Compare version parts (without release number)
    const versionCompare = this._compareVersionParts(
      parsed1.version,
      parsed2.version,
    );
    if (versionCompare !== 0) {
      return versionCompare;
    }

    // Compare prerelease identifiers
    const prerelease1 = parsed1.prerelease;
    const prerelease2 = parsed2.prerelease;

    if (prerelease1 || prerelease2) {
      if (!prerelease1) {
        return -1; // Stable version is less than prerelease
      }
      if (!prerelease2) {
        return 1; // Prerelease version is greater than stable
      }
      // Both have prerelease identifiers, compare them
      const prereleaseCompare = prerelease1.localeCompare(prerelease2);
      if (prereleaseCompare !== 0) {
        return prereleaseCompare;
      }
    }

    // Compare release numbers
    const release1 = parsed1.releaseString || '';
    const release2 = parsed2.releaseString || '';

    // If one has a release number and the other doesn't, the one with release number is greater
    if (release1 && !release2) {
      return 1;
    }
    if (!release1 && release2) {
      return -1;
    }

    // If both have release numbers or neither has release numbers, compare them
    const releaseCompare = this._compareVersionParts(
      release1 || '0',
      release2 || '0',
    );
    return releaseCompare;
  }

  /**
   * Compare version parts using APK's version comparison rules
   */
  private _compareVersionParts(v1: string, v2: string): number {
    if (v1 === v2) {
      return 0;
    }
    const alphaNumPattern = regEx(/([a-zA-Z]+)|(\d+)/g);
    /* v8 ignore next -- defensive null handling, regex always matches valid version strings */
    const matchesv1 = v1.match(alphaNumPattern) ?? [];
    /* v8 ignore next -- defensive null handling, regex always matches valid version strings */
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
      } else if (matchv1 && matchv2) {
        // Both are strings, compare lexicographically
        if (matchv1 !== matchv2) {
          return matchv1.localeCompare(matchv2);
        }
      } /* v8 ignore next 3 -- unreachable in practice due to regex matching behavior */ else {
        // One is undefined, the other exists
        return matchv1 ? 1 : -1;
      }
    }

    // Handle remaining segments when one version has more parts
    if (matchesv1.length !== matchesv2.length) {
      const maxLength = Math.max(matchesv1.length, matchesv2.length);
      for (let i = matches; i < maxLength; i++) {
        const matchv1 = matchesv1[i];
        const matchv2 = matchesv2[i];

        if (matchv1 && /^\d+$/.test(matchv1)) {
          // v1 has a number, v2 doesn't (implicit 0), numbers are greater
          return 1;
        } else if (matchv2 && /^\d+$/.test(matchv2)) {
          // v2 has a number, v1 doesn't (implicit 0), numbers are greater
          return -1;
          /* v8 ignore next 3 -- unreachable in practice, lengths differ so both can't have parts at same index */
        } else if (matchv1 && matchv2) {
          // Both have non-numeric parts, compare lexicographically
          return matchv1.localeCompare(matchv2);
        } else if (matchv1) {
          // v1 has a non-numeric part, v2 doesn't (implicit empty), letters are less than empty
          return -1;
        } else if (matchv2) {
          // v2 has a non-numeric part, v1 doesn't (implicit empty), letters are less than empty
          return 1;
        }
        /* v8 ignore next -- unreachable in practice due to early returns in loop */
      }
      /* v8 ignore next -- unreachable in practice due to early returns in loop */
    }

    // All parts compared successfully, versions are equal
    /* v8 ignore next -- unreachable in practice due to early returns in comparison logic */
    return 0;
  }

  override isValid(version: string): boolean {
    if (!version) {
      return false;
    }
    // Strip any operators (=, >, <, ~) before validation
    const cleanVersion = version.replace(/^[=><~][=]?/, '');
    const parsed = this._parse(cleanVersion);
    return parsed !== null;
  }

  override isSingleVersion(version: string): boolean {
    if (!version) {
      return false;
    }
    // Range constraints (>, >=, <, <=, ~) are not single versions
    if (/^[><~]/.test(version)) {
      return false;
    }
    // Exact versions (starting with = or no operator) are single versions
    return this.isValid(version);
  }

  override isStable(version: string): boolean {
    if (!version) {
      return false;
    }
    // Strip any operators (=, >, <, ~) before checking stability
    const cleanVersion = version.replace(/^[=><~][=]?/, '');
    const parsed = this._parse(cleanVersion);
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
    // Handle range expressions like >5.2.37-r0, <5.2.37-r0, ~5.2.37-r0, etc.
    const rangeMatch = /^([><=~]+)(.+)$/.exec(range);
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
          /* v8 ignore next 3 -- unreachable defensive code, isValid filters out invalid versions */
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
        /* v8 ignore next 2 -- unreachable defensive code for unknown range operators */
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
    if (!version) {
      return null;
    }
    // Strip any operators (=, >, <, ~) before parsing
    const cleanVersion = version.replace(/^[=><~][=]?/, '');
    const parsed = this._parse(cleanVersion);
    return parsed?.release[0] ?? null;
  }

  override getMinor(version: string): number | null {
    if (!version) {
      return null;
    }
    // Strip any operators (=, >, <, ~) before parsing
    const cleanVersion = version.replace(/^[=><~][=]?/, '');
    const parsed = this._parse(cleanVersion);
    return parsed?.release[1] ?? null;
  }

  override getPatch(version: string): number | null {
    if (!version) {
      return null;
    }
    // Strip any operators (=, >, <, ~) before parsing
    const cleanVersion = version.replace(/^[=><~][=]?/, '');
    const parsed = this._parse(cleanVersion);
    if (!parsed) {
      return null;
    }
    return parsed.release[2] ?? null;
  }

  override getNewValue({
    currentValue,
    newVersion,
  }: {
    currentValue: string;
    rangeStrategy?: string;
    currentVersion?: string;
    newVersion: string;
  }): string | null {
    // APK packages in apko.yaml only use exact versions
    // currentValue is stored without the = operator for cleaner PR display

    const hasRevision = /-r\d+$/.test(currentValue);

    // If current version has no revision, strip revision from newVersion
    // This ensures both newValue and the displayed version are clean
    if (!hasRevision) {
      return newVersion.replace(/-r\d+$/, '');
    }

    // If current version has revision, keep revision in newVersion
    return newVersion;
  }

  // Override to provide clean version for PR titles and display
  override sortVersions(a: string, b: string): number {
    // Strip = prefix if present for comparison
    const cleanA = a.replace(/^=/, '');
    const cleanB = b.replace(/^=/, '');
    return super.sortVersions(cleanA, cleanB);
  }
}

export const api: VersioningApi = new ApkVersioningApi();

export default api;
