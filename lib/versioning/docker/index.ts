import { regEx } from '../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'docker';
export const displayName = 'Docker';
export const urls = [
  'https://docs.docker.com/engine/reference/commandline/tag/',
];
export const supportsRanges = false;

const versionPattern = regEx(/^(?<version>\d+(?:\.\d+)*)(?<prerelease>.*)$/);
const commitHashPattern = regEx(/^[a-f0-9]{7,40}$/);
const numericPattern = regEx(/^[0-9]+$/);

class DockerVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (!version) {
      return null;
    }
    if (commitHashPattern.test(version) && !numericPattern.test(version)) {
      return null;
    }
    const versionPieces = version.replace(regEx(/^v/), '').split('-');
    const prefix = versionPieces.shift();
    const suffix = versionPieces.join('-');
    const m = versionPattern.exec(prefix);
    if (!m?.groups) {
      return null;
    }

    const { version: ver, prerelease } = m.groups;
    const release = ver.split('.').map(Number);
    return { release, suffix, prerelease };
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
      return parsed1.prerelease.localeCompare(parsed2.prerelease);
    }
    // equals
    return parsed2.suffix.localeCompare(parsed1.suffix);
  }

  override isCompatible(version: string, current: string): boolean {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(current);
    return (
      parsed1.suffix === parsed2.suffix &&
      parsed1.release.length === parsed2.release.length
    );
  }

  valueToVersion(value: string): string {
    // Remove any suffix after '-', e.g. '-alpine'
    return value ? value.split('-')[0] : value;
  }
}

export const api: VersioningApi = new DockerVersioningApi();

export default api;
