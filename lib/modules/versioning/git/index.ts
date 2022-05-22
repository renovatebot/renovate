import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'git';
export const displayName = 'git';
export const urls = ['https://git-scm.com/'];
export const supportsRanges = false;

const regex = regEx('^[0-9a-f]{7,40}$', 'i');

class GitVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (version?.match(regex)) {
      return { release: [1, 0, 0], suffix: version };
    }
    return null;
  }

  protected override _compare(_version: string, _other: string): number {
    return -1;
  }
}

export const api: VersioningApi = new GitVersioningApi();

export default api;
