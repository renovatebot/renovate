import { Datasource } from '../datasource';
import { getReleases } from '../maven';
import { MAVEN_REPO } from '../maven/common';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class ClojureDatasource extends Datasource {
  static readonly id = 'clojure';

  constructor() {
    super(ClojureDatasource.id);
  }

  override readonly registryStrategy = 'merge';

  override readonly defaultRegistryUrls = [
    'https://clojars.org/repo',
    MAVEN_REPO,
  ];

  getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    return getReleases({ lookupName, registryUrl });
  }
}
