import { SemVer } from 'semver';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'glasskube';
export const displayName = 'glasskube';
export const urls = [];
export const supportsRanges = false;

export class GlasskubeVersioningApi extends GenericVersioningApi {
  protected override _parse(version: string): GenericVersion | null {
    let parsedVersion: SemVer;
    try {
      parsedVersion = new SemVer(version);
    } catch {
      return null;
    }
    const result: GenericVersion = {
      release: [parsedVersion.major, parsedVersion.minor, parsedVersion.patch],
      prerelease:
        parsedVersion.prerelease.length > 0
          ? parsedVersion.prerelease.join('.')
          : undefined,
    };
    const build = parsedVersion.build.at(0);
    if (build) {
      try {
        result.release.push(parseInt(build));
      } catch {
        /* noop */
      }
    }
    return result;
  }
}

export const api: VersioningApi = new GlasskubeVersioningApi();
export default api;
