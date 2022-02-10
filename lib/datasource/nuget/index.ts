import { logger } from '../../logger';
import * as nugetVersioning from '../../versioning/nuget';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { parseRegistryUrl } from './util';
import * as v2 from './v2';
import * as v3 from './v3';

export class NugetDatasource extends Datasource {
  static readonly id = 'nuget';

  override readonly defaultRegistryUrls = [
    'https://api.nuget.org/v3/index.json',
  ];

  override readonly defaultVersioning = nugetVersioning.id;

  override readonly registryStrategy = 'merge';

  constructor() {
    super(NugetDatasource.id);
  }

  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult> {
    logger.trace(`nuget.getReleases(${lookupName})`);
    const { feedUrl, protocolVersion } = parseRegistryUrl(registryUrl);
    if (protocolVersion === 2) {
      return v2.getReleases(this.http, feedUrl, lookupName);
    }
    if (protocolVersion === 3) {
      const queryUrl = await v3.getResourceUrl(this.http, feedUrl);
      if (queryUrl) {
        return v3.getReleases(this.http, feedUrl, queryUrl, lookupName);
      }
    }
    return null;
  }
}
