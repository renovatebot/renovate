import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'unity3d';
export const displayName = 'Unity3D';
export const urls = [
  'https://docs.unity3d.com/Manual/ScriptCompilationAssemblyDefinitionFiles.html#version-define-expressions',
];
export const supportsRanges = false;

class Unity3dVersioningApi extends GenericVersioningApi {
  private static readonly parsingRegex = regEx(
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?<releaseStream>\w)(?<build>\d+)/,
  );

  private static readonly ReleaseStreamType = [
    'a', // Alpha
    'b', // Beta
    'p', // Patch
    'x', // Experimental
    'f', // Stable
    'c', // Stable (China)
  ];
  private static readonly stableVersions = ['f', 'c'];

  protected _parse(version: string): GenericVersion | null {
    const matches = Unity3dVersioningApi.parsingRegex.exec(version);
    if (!matches?.groups) {
      return null;
    }
    const { major, minor, patch, releaseStream, build } = matches.groups;

    const release = [
      parseInt(major, 10),
      parseInt(minor, 10),
      parseInt(patch, 10),
      Unity3dVersioningApi.ReleaseStreamType.indexOf(releaseStream),
      parseInt(build, 10),
    ];
    const isStable =
      Unity3dVersioningApi.stableVersions.includes(releaseStream);

    return { release, prerelease: isStable ? undefined : build };
  }
}

export const api: VersioningApi = new Unity3dVersioningApi();

export default api;
