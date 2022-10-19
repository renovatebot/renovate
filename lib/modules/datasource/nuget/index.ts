import { logger } from '../../../logger';
import * as nugetVersioning from '../../versioning/nuget';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { parseRegistryUrl } from './common';
import * as v2 from './v2';
import * as v3 from './v3';

// https://api.nuget.org/v3/index.json is a default official nuget feed
export const defaultRegistryUrls = ['https://api.nuget.org/v3/index.json'];

export class NugetDatasource extends Datasource {
  static readonly id = 'nuget';

  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly defaultVersioning = nugetVersioning.id;

  override readonly registryStrategy = 'merge';

  constructor() {
    super(NugetDatasource.id);
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace(`nuget.getReleases(${packageName})`);
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const { feedUrl, protocolVersion } = parseRegistryUrl(registryUrl);
    if (protocolVersion === 2) {
      return v2.getReleases(this.http, feedUrl, packageName);
    }
    if (protocolVersion === 3) {
      const queryUrl = await v3.getResourceUrl(this.http, feedUrl);
      if (queryUrl) {
        return v3.getReleases(this.http, feedUrl, queryUrl, packageName);
      }
    }
    return null;
  }
}
