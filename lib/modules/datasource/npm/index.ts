import * as npmVersioning from '../../versioning/npm';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getDependency } from './get';

export { setNpmrc } from './npmrc';

export class NpmDatasource extends Datasource {
  static readonly id = 'npm';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = npmVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimeStampNote =
    'To get release timestamp we use the `time` object which contains the release date for each version in a string to string mapping.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote = `
    1. We extract url from the repository object present in the response body (not inside versions array)
    2. We extract url from the repository object present in each version object present in the versions array from the response
    We prefer (2), if (1) and (2) are different.
    `;

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
