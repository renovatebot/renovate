import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'redhat';
export const displayName = 'Red Hat';
export const urls = [];
export const supportsRanges = false;

const pattern = regEx(
  /^(?<major>\d+)(?:\.(?<minor>\d+))?(?:\.(?<patch>\d+))?(?:-(?<releaseMajor>\d+)(?:\.(?<releaseMinor>\d+))?)?$/,
);

class RedhatVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    const matches = pattern.exec(version)?.groups;
    if (!matches) {
      return null;
    }

    const { major, minor, patch, releaseMajor, releaseMinor } = matches;
    const release = [
      Number.parseInt(major, 10),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor, 10),
      typeof patch === 'undefined' ? 0 : Number.parseInt(patch, 10),
      typeof releaseMajor === 'undefined'
        ? 0
        : Number.parseInt(releaseMajor, 10),
      typeof releaseMinor === 'undefined'
        ? 0
        : Number.parseInt(releaseMinor, 10),
    ];

    return { release, prerelease: '' };
  }
}

export const api: VersioningApi = new RedhatVersioningApi();

export default api;
