import { cache } from '../../../util/cache/package/decorator';
import * as p from '../../../util/promises';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import {
  DotnetRuntimeReleases,
  DotnetSdkReleases,
  ReleasesIndex,
} from './schema';

export class DotnetVersionDatasource extends Datasource {
  static readonly id = 'dotnet-version';

  constructor() {
    super(DotnetVersionDatasource.id);
  }

  override readonly caching = true;

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [
    'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json',
  ];

  @cache({
    namespace: `datasource-${DotnetVersionDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
    ttlMinutes: 1440,
  })
  async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!(packageName === 'dotnet-sdk' || packageName === 'dotnet-runtime')) {
      return null;
    }

    try {
      const registryUrl = this.defaultRegistryUrls[0];
      const { body: urls } = await this.http.getJson(
        registryUrl,
        ReleasesIndex,
      );

      const channelReleases = await p.map(
        urls,
        (url) => this.getChannelReleases(url, packageName),
        { concurrency: 1, stopOnError: true },
      );
      const releases = channelReleases.flat();

      const sourceUrl =
        packageName === 'dotnet-sdk'
          ? 'https://github.com/dotnet/sdk'
          : 'https://github.com/dotnet/runtime';

      return { releases, sourceUrl };
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  @cache({
    namespace: `datasource-${DotnetVersionDatasource.id}`,
    key: (releaseUrl: string, packageName: string) =>
      `${releaseUrl}:${packageName}`,
    ttlMinutes: 1440,
  })
  async getChannelReleases(
    releaseUrl: string,
    packageName: string,
  ): Promise<Release[]> {
    const schema =
      packageName === 'dotnet-sdk' ? DotnetSdkReleases : DotnetRuntimeReleases;
    try {
      const { body } = await this.http.getJson(releaseUrl, schema);
      return body;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }
}
