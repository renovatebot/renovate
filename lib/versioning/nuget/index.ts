import semver from 'semver';
import { regEx } from '../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = false;

const pattern = regEx(
  /^(?<prefix>\d+(?:\.\d+)*)(?<prerelease>-[^+]+)?(?<suffix>\+.*)?$/
);

class NugetVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion {
    const matches = pattern.exec(version);
    if (!matches) {
      return null;
    }
    const { prefix, prerelease } = matches.groups;
    const release = prefix.split('.').map(Number);
    return { release, prerelease: prerelease || '' };
  }

  protected override _compare(version: string, other: string): number {
    const parsed1 = semver.parse(version);
    const parsed2 = semver.parse(other);

    if (parsed1 && parsed2) {
      return parsed1.compare(parsed2);
    }

    return super._compare(version, other);
  }
}

export const api: VersioningApi = new NugetVersioningApi();

export default api;
