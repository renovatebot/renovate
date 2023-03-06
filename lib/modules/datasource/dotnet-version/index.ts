import is from '@sindresorhus/is';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import {
  DotnetRelease,
  DotnetReleases,
  DotnetReleasesIndex,
  DotnetReleasesIndexSchema,
  DotnetReleasesSchema,
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

    let result: ReleaseResult | null = null;

    let raw: HttpResponse<DotnetReleasesIndex> | null = null;
    try {
      raw = await this.http.getJson(
        this.defaultRegistryUrls[0],
        DotnetReleasesIndexSchema
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const releases: Release[] = [];
      const { 'releases-index': releasesIndex } = body;

      for (const { 'releases.json': releasesUrl } of releasesIndex) {
        const channelReleases = await this.getChannelReleases(
          releasesUrl,
          packageName
        );
        if (channelReleases) {
          releases.push(...channelReleases);
        }
      }

      const sourceUrl =
        packageName === 'dotnet-sdk'
          ? 'https://github.com/dotnet/sdk'
          : 'https://github.com/dotnet/runtime';

      result = { releases, sourceUrl };
    }

    return result;
  }

  @cache({
    namespace: `datasource-${DotnetVersionDatasource.id}`,
    key: (releaseUrl: string, packageName: string) =>
      `${releaseUrl}:${packageName}`,
    ttlMinutes: 1440,
  })
  async getChannelReleases(
    releaseUrl: string,
    packageName: string
  ): Promise<Release[] | null> {
    let result: Release[] = [];

    let raw: HttpResponse<DotnetReleases> | null = null;
    try {
      raw = await this.http.getJson(releaseUrl, DotnetReleasesSchema);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const type = DotnetVersionDatasource.getType(packageName);
      const { releases: releases } = body;
      result = releases
        .filter(
          (
            release
          ): release is {
            [P in keyof DotnetRelease]: NonNullable<DotnetRelease[P]>;
          } => {
            return !is.nullOrUndefined(release[type]);
          }
        )
        .map((release) => {
          return {
            version: release[type].version,
            releaseTimestamp: release['release-date'],
            changelogUrl: release['release-notes'],
          };
        });
    }

    return result;
  }

  private static getType(packageName: string): 'sdk' | 'runtime' {
    return packageName === 'dotnet-sdk' ? 'sdk' : 'runtime';
  }
}
