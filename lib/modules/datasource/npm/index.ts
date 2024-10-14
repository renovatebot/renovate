import * as npmVersioning from '../../versioning/npm';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { defaultRegistryUrls as npmDefaultRegistryUrl } from './common';
import { getDependency } from './get';

export { setNpmrc } from './npmrc';

export class NpmDatasource extends Datasource {
  static readonly id = 'npm';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = npmVersioning.id;

  override readonly defaultRegistryUrls = npmDefaultRegistryUrl;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `time` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field in the results.';

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
    return res;
  }
}
