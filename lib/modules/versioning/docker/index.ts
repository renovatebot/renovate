import type { SemVer } from 'semver';
import { parse as parseSemver } from 'semver';

import { regEx } from '../../../util/regex';
import { coerceString } from '../../../util/string';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'docker';
export const displayName = 'Docker';
export const urls = [
  'https://docs.docker.com/engine/reference/commandline/tag/',
];
export const supportsRanges = false;

const versionPattern = regEx(/^(?<version>\d+(?:\.\d+)*)(?<prerelease>\w*)$/);
const commitHashPattern = regEx(/^[a-f0-9]{7,40}$/);
const numericPattern = regEx(/^[0-9]+$/);

class DockerVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (!version) {
      return null;
    }

    // Try to identify a pure semver prerelease first
    const semver = this.parseSemverPrerelease(version);
    if (semver) {
      return {
        release: [semver.major, semver.minor, semver.patch],
        prerelease: semver.prerelease.join('.'),
      };
    }

    if (commitHashPattern.test(version) && !numericPattern.test(version)) {
      return null;
    }
    const versionPieces = version.replace(regEx(/^v/), '').split('-');
    const [prefix, ...suffixPieces] = versionPieces;
    const matchGroups = prefix?.match(versionPattern)?.groups;
    if (!matchGroups) {
      return null;
    }

    const { version: ver, prerelease } = matchGroups;
    const release = ver.split('.').map(Number);
    return { release, suffix: suffixPieces.join('-'), prerelease };
  }

  protected override _compare(version: string, other: string): number {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);
    // istanbul ignore if
    if (!(parsed1 && parsed2)) {
      return 1;
    }
    const length = Math.max(parsed1.release.length, parsed2.release.length);
    for (let i = 0; i < length; i += 1) {
      const part1 = parsed1.release[i];
      const part2 = parsed2.release[i];
      // shorter is bigger 2.1 > 2.1.1
      if (part1 === undefined) {
        return 1;
      }
      if (part2 === undefined) {
        return -1;
      }
      if (part1 !== part2) {
        return part1 - part2;
      }
    }
    if (parsed1.prerelease !== parsed2.prerelease) {
      // unstable is lower
      if (!parsed1.prerelease && parsed2.prerelease) {
        return 1;
      }
      if (parsed1.prerelease && !parsed2.prerelease) {
        return -1;
      }
      // alphabetic order
      if (parsed1.prerelease && parsed2.prerelease) {
        return parsed1.prerelease.localeCompare(parsed2.prerelease);
      }
    }

    // equals
    const suffix1 = coerceString(parsed1.suffix);
    const suffix2 = coerceString(parsed2.suffix);
    return suffix2.localeCompare(suffix1);
  }

  override isCompatible(version: string, current: string): boolean {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(current);
    return !!(
      parsed1 &&
      parsed2 &&
      parsed1.suffix === parsed2.suffix &&
      parsed1.release.length === parsed2.release.length
    );
  }

  private parseSemverPrerelease(version: string): SemVer | null {
    const semver = parseSemver(version);
    if (!semver) {
      return null;
    }
    if (semver.prerelease.length === 0) {
      return null;
    }
    // Only consider the likes of 1.2.3-4 and 1.2.3-beta.0 to avoid catching 1.2.3-alpine as prerelease
    const last = semver.prerelease[semver.prerelease.length - 1];
    if (typeof last === 'number') {
      return semver;
    }
    return null;
  }

  valueToVersion(value: string): string {
    if (!value) {
      return value;
    }

    // Try to identify a pure semver prerelease first
    if (this.parseSemverPrerelease(value)) {
      return value;
    }

    // Remove any suffix after '-', e.g. '-alpine'
    return value.split('-')[0];
  }
}

export const api: VersioningApi = new DockerVersioningApi();

export default api;
