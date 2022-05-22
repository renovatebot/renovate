import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'loose';
export const displayName = 'Loose';
export const urls = [];
export const supportsRanges = false;

const versionPattern = regEx(/^v?(\d+(?:\.\d+)*)(.*)$/);
const commitHashPattern = regEx(/^[a-f0-9]{7,40}$/);
const numericPattern = regEx(/^[0-9]+$/);

class LooseVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (commitHashPattern.test(version) && !numericPattern.test(version)) {
      return null;
    }
    const matches = versionPattern.exec(version);
    if (!matches) {
      return null;
    }
    const [, prefix, suffix] = matches;
    const release = prefix.split('.').map(Number);
    if (release.length > 6) {
      return null;
    }
    return { release, suffix: suffix || '' };
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
      // shorter is smaller 2.1 < 2.1.0
      if (part1 === undefined) {
        return -1;
      }
      if (part2 === undefined) {
        return 1;
      }
      if (part1 !== part2) {
        return part1 - part2;
      }
    }

    if (parsed1.suffix && parsed2.suffix) {
      return parsed1.suffix.localeCompare(parsed2.suffix);
    }

    if (parsed1.suffix) {
      return -1;
    }

    if (parsed2.suffix) {
      return 1;
    }

    // istanbul ignore next
    return 0;
  }
}

export const api: VersioningApi = new LooseVersioningApi();

export default api;
