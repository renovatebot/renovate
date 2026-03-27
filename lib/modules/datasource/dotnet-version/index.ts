import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as p from '../../../util/promises.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import {
  DotnetRuntimeReleases,
  DotnetSdkReleases,
  ReleasesIndex,
} from './schema.ts';

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

  override releaseTimestampSupport = true;
  override releaseTimestampNote =
    'The release timestamp is determined from the `release-date` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL https://github.com/dotnet/sdk for the `dotnet-sdk` package and, the https://github.com/dotnet/runtime URL for the `dotnet-runtime` package.';

  private async _getReleases({
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

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${DotnetVersionDatasource.id}`,
        key: config.packageName,
        ttlMinutes: 1440,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getChannelReleases(
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

  getChannelReleases(
    releaseUrl: string,
    packageName: string,
  ): Promise<Release[]> {
    return withCache(
      {
        namespace: `datasource-${DotnetVersionDatasource.id}`,
        key: `${releaseUrl}:${packageName}`,
        ttlMinutes: 1440,
      },
      () => this._getChannelReleases(releaseUrl, packageName),
    );
  }
}
