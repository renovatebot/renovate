import { regEx } from '../../../util/regex';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'unity3d-packages';
export const displayName = 'Unity3D Packages';
export const urls = [
  'https://docs.unity3d.com/Manual/upm-semver.html',
  'https://docs.unity3d.com/Manual/upm-lifecycle.html',
];
export const supportsRanges = false;

class Unity3dPackagesVersioningApi extends GenericVersioningApi {
  private static readonly parsingRegex = regEx(
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-?(?<label>.*))/,
  );
  private static readonly unstableRegex = regEx(/^(exp.|pre.|preview.)/);

  protected _parse(version: string): GenericVersion | null {
    const matches = Unity3dPackagesVersioningApi.parsingRegex.exec(version);
    if (!matches?.groups) {
      return null;
    }
    const { major, minor, patch, label } = matches.groups;

    const release = [
      parseInt(major, 10),
      parseInt(minor, 10),
      parseInt(patch, 10),
    ];
    const isStable = !Unity3dPackagesVersioningApi.unstableRegex.test(label);

    return { release, prerelease: isStable ? undefined : label };
  }
}

export const api: VersioningApi = new Unity3dPackagesVersioningApi();

export default api;
