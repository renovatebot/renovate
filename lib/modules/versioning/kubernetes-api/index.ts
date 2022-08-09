import { RegExpVersion, RegExpVersioningApi } from '../regex';
import type { VersioningApi } from '../types';

export const id = 'kubernetes-api';
export const displayName = 'kubernetes-api';
export const urls = [
  'https://kubernetes.io/docs/reference/using-api/#api-versioning',
];
export const supportsRanges = false;

export class KubernetesApiVersioningApi extends RegExpVersioningApi {
  private static readonly versionRegex =
    '^(?:(?<compatibility>\\S+)\\/)?v(?<major>\\d+)(?<prerelease>(?:alpha|beta)\\d+)?$';

  public constructor() {
    super(KubernetesApiVersioningApi.versionRegex);
  }

  protected override _parse(version: string): RegExpVersion | null {
    const parsed = super._parse(version);
    if (parsed) {
      return parsed;
    }

    const groups = this._config?.exec(version)?.groups;

    if (!groups) {
      return null;
    }

    if (groups) {
      const { compatibility, version, prerelease } = groups;
      return {
        compatibility,
        release: [parseInt(version, 10)],
        prerelease,
      };
    }

    return null;
  }
}

export const api: VersioningApi = new KubernetesApiVersioningApi();

export default api;
