import JSON5 from 'json5';
import dataFiles from '../../../data-files.generated';
import * as kubernetesApiVersioning from '../../versioning/kubernetes-api';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class KubernetesApiDatasource extends Datasource {
  static readonly id = 'kubernetes-api';
  private readonly kubernetesApiVersions: Record<string, string[]>;

  constructor() {
    super(KubernetesApiDatasource.id);
    this.kubernetesApiVersions = JSON5.parse(
      dataFiles.get('data/kubernetes-api.json5')!
    );
  }

  override defaultVersioning = kubernetesApiVersioning.id;

  getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const versions = this.kubernetesApiVersions[packageName];
    if (versions) {
      const releases = versions.map((version) => ({ version }));
      return Promise.resolve({ releases });
    }

    return Promise.resolve(null);
  }
}
