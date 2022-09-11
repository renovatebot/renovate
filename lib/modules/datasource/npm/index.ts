import * as npmVersioning from '../../versioning/npm';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { id } from './common';
import { getDependency } from './get';

export { setNpmrc } from './npmrc';

export class NpmDatasource extends Datasource {
  static readonly id = id;

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = npmVersioning.id;

  constructor() {
    super(NpmDatasource.id);
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const res = await getDependency(this.http, registryUrl, packageName);
    if (res) {
      res.tags ||= res['dist-tags'];
      delete res['dist-tags'];
    }
    return res;
  }
}
