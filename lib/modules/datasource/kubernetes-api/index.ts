import JSON5 from 'json5';
import dataFiles from '../../../data-files.generated.ts';
import * as kubernetesApiVersioning from '../../versioning/kubernetes-api/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';

const apiData: Record<string, string[]> = JSON5.parse(
  dataFiles.get('data/kubernetes-api.json5')!,
);

export const supportedApis = new Set(Object.keys(apiData));

export class KubernetesApiDatasource extends Datasource {
  static readonly id = 'kubernetes-api';

  constructor() {
    super(KubernetesApiDatasource.id);
  }

  override defaultVersioning = kubernetesApiVersioning.id;

  getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const versions = apiData[packageName];
    if (versions) {
      const releases = versions.map((version) => ({ version }));
      return Promise.resolve({ releases });
    }

    return Promise.resolve(null);
  }
}
