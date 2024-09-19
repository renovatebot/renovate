import { regEx } from '../../../util/regex';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'devbox';
export const displayName = 'devbox';

export const supportsRanges = false;

const versionPattern = regEx(/^((\d|[1-9]\d*)(\.(\d|[1-9]\d*)){0,2})$/);

class DevboxVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    const matches = versionPattern.exec(version);
    if (!matches) {
      return null;
    }
    const release = matches[0].split('.').map(Number);
    return { release };
  }

  override isValid(version: string): boolean {
    if (version === 'latest') {
      return true;
    }
    return this._parse(version) !== null;
  }

  override isVersion(version: string): boolean {
    if (version === 'latest') {
      return false;
    }
    return this.isValid(version);
  }

  protected override _compare(version: string, other: string): number {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(other);
    if (!(parsed1 && parsed2)) {
      return 0;
    }
    // support variable length compare
    const length = Math.max(parsed1.release.length, parsed2.release.length);
    for (let i = 0; i < length; i += 1) {
      // 2.1 and 2.1.0 are equivalent
      const part1 = parsed1.release[i];
      const part2 = parsed2.release[i];
      // if part1 or part2 is undefined, we should treat them as equal
      // e.g. 1.0.0 === 1.0
      if (part1 !== undefined && part2 !== undefined && part1 !== part2) {
        return part1 - part2;
      }
    }
    return 0;
  }
}

export const api: VersioningApi = new DevboxVersioningApi();

export default api;
