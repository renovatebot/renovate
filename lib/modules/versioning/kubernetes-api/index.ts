import { RegExpVersioningApi } from '../regex';
import type { VersioningApi } from '../types';

export const id = 'kubernetes-api';
export const displayName = 'Kubernetes API';
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
}

export const api: VersioningApi = new KubernetesApiVersioningApi();

export default api;
