import { regEx } from '../../../util/regex.ts';
import type { GenericVersion } from '../generic.ts';
import { GenericVersioningApi } from '../generic.ts';
import type { VersioningApi } from '../types.ts';

export const id = 'redhat';
export const displayName = 'Red Hat';
export const urls = [];
export const supportsRanges = false;

const pattern = regEx(
  /^v?(?<major>\d+)(?:\.(?<minor>\d+))?(?:\.(?<patch>\d+))?(\.GA)?(?:-(?<releaseMajor>\d+)(?:\.(?<releaseMinor>\d+))?)?$/,
);

class RedhatVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    const matches = pattern.exec(version)?.groups;
    if (!matches) {
      return null;
    }

    const { major, minor, patch, releaseMajor, releaseMinor } = matches;
    const release = [
      Number.parseInt(major),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor),
      typeof patch === 'undefined' ? 0 : Number.parseInt(patch),
      typeof releaseMajor === 'undefined' ? 0 : Number.parseInt(releaseMajor),
      typeof releaseMinor === 'undefined' ? 0 : Number.parseInt(releaseMinor),
    ];

    return { release, prerelease: '' };
  }
}

export const api: VersioningApi = new RedhatVersioningApi();

export default api;
