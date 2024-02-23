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
    /^(?<Major>\d+)\.(?<Minor>\d+)\.(?<Patch>\d+)(?<ReleaseStream>\w)(?<Build>\d+)/gm,
  );

  private static readonly ReleaseStreamType = new Map([
    ['Alpha', 'a'],
    ['Beta', 'b'],
    ['Patch', 'p'],
    ['Experimental', 'x'],
    ['Stable', 'f'],
    ['Stable (China)', 'c'],
  ]);
  private static readonly stableVersions = [
    Unity3dVersioningApi.ReleaseStreamType.get('Stable'),
    Unity3dVersioningApi.ReleaseStreamType.get('Stable (China)'),
  ];
  private static readonly ReleaseStreamTypeKeyOrder = Array.from(
    Unity3dVersioningApi.ReleaseStreamType.values(),
  );

  protected _parse(version: string): GenericVersion | null {
    Unity3dVersioningApi.parsingRegex.lastIndex = 0;
    const matches = Unity3dVersioningApi.parsingRegex.exec(version);
    if (!matches?.groups) {
      return null;
    }
    const { Major, Minor, Patch, ReleaseStream, Build } = matches.groups;

    const release = [
      parseInt(Major),
      parseInt(Minor),
      parseInt(Patch),
      Unity3dVersioningApi.ReleaseStreamTypeKeyOrder.indexOf(ReleaseStream),
      parseInt(Build),
    ];
    const isStable =
      Unity3dVersioningApi.stableVersions.includes(ReleaseStream);

    return { release, prerelease: isStable ? undefined : Build };
  }
}

export const api: VersioningApi = new Unity3dVersioningApi();

export default api;
