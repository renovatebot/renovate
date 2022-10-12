import is from '@sindresorhus/is';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import {
  DotnetReleases,
  DotnetReleasesIndex,
  DotnetReleasesIndexSchema,
  DotnetReleasesSchema,
} from './schema';

export class DotnetDatasource extends Datasource {
  static readonly id = 'dotnet';

  constructor() {
    super(DotnetDatasource.id);
  }

  override readonly caching = true;

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [
    'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json',
  ];

  @cache({
    namespace: `datasource-${DotnetDatasource.id}`,
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

      result = { releases };
    }

    return result;
  }

  @cache({
    namespace: `datasource-${DotnetDatasource.id}`,
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
      const type = DotnetDatasource.getType(packageName);
      const { releases: releases } = body;
      result = releases
        .map((release) => {
          return {
            version: release[type]?.version,
            releaseTimestamp: release['release-date'],
            changelogUrl: release['release-notes'],
          };
        })
        .filter((release) => is.nonEmptyString(release.version)) as Release[];
    }

    return result;
  }

  private static getType(packageName: string): 'sdk' | 'runtime' {
    return packageName === 'dotnet-sdk' ? 'sdk' : 'runtime';
  }
}
