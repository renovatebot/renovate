import { logger } from '../../../logger';
import * as nugetVersioning from '../../versioning/nuget';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { parseRegistryUrl } from './common';
import { NugetV2Api } from './v2';
import { NugetV3Api } from './v3';

// https://api.nuget.org/v3/index.json is a default official nuget feed
export const nugetOrg = 'https://api.nuget.org/v3/index.json';

export class NugetDatasource extends Datasource {
  static readonly id = 'nuget';

  override readonly defaultRegistryUrls = [nugetOrg];

  override readonly defaultVersioning = nugetVersioning.id;

  override readonly registryStrategy = 'merge';

  readonly v2Api = new NugetV2Api();

  readonly v3Api = new NugetV3Api();

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
      return this.v2Api.getReleases(this.http, feedUrl, packageName);
    }
    if (protocolVersion === 3) {
      const queryUrl = await this.v3Api.getResourceUrl(this.http, feedUrl);
      if (queryUrl) {
        return this.v3Api.getReleases(
          this.http,
          feedUrl,
          queryUrl,
          packageName,
        );
      }
    }
    return null;
  }
}
