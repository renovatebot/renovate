import { regEx } from '../../../util/regex';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';
import type { KubernetesApiVersion } from './types';

export const id = 'kubernetes-api';
export const displayName = 'kubernetes-api';
export const urls = [
  'https://kubernetes.io/docs/reference/using-api/#api-versioning',
];
export const supportsRanges = false;

const kubernetesApiRegex = regEx(
  '^(?<apiGroup>\\S+\\/)?v(?<version>\\d+)(?<prerelease>(?:alpha|beta)\\d+)?$'
);

export class KubernetesApiVersioningApi extends GenericVersioningApi<KubernetesApiVersion> {
  protected _parse(version: string): KubernetesApiVersion | null {
    if (version) {
      const matchGroups = kubernetesApiRegex.exec(version)?.groups;
      if (matchGroups) {
        const { apiGroup, version, prerelease } = matchGroups;
        return { apiGroup, release: [parseInt(version, 10)], prerelease };
      }
    }
    return null;
  }
}

export const api: VersioningApi = new KubernetesApiVersioningApi();

export default api;
