import { regEx } from '../../util/regex';
import type { VersioningApi } from '../types';
import { GenericVersion, GenericVersioningApi } from './generic';

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
    const [, prefix, prerelease] = matches;
    const release = prefix.split('.').map(Number);
    if (release.length > 6) {
      return null;
    }
    return { release, prerelease: prerelease ?? '' };
  }
}

export const api: VersioningApi = new LooseVersioningApi();

export default api;
