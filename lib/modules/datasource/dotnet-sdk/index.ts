import is from '@sindresorhus/is';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { DotnetSdkReleases, DotnetSdkReleasesIndex } from './types';

export class DotnetSdkDatasource extends Datasource {
  static readonly id = 'dotnet-sdk';

  constructor() {
    super(DotnetSdkDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [
    'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json',
  ];

  @cache({
    namespace: `datasource-${DotnetSdkDatasource.id}`,
    key: DotnetSdkDatasource.id,
  })
  async getReleases(_: GetReleasesConfig): Promise<ReleaseResult | null> {
    let result: ReleaseResult | null = null;

    let raw: HttpResponse<DotnetSdkReleasesIndex> | null = null;
    try {
      raw = await this.http.getJson<DotnetSdkReleasesIndex>(
        this.defaultRegistryUrls[0]
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const { 'releases-index': releasesIndex } = body;
      const releases = (
        await Promise.all(
          releasesIndex
            .map((i) => i['releases.json'])
            .map(
              async (releaseUrl) => await this.getChannelReleases(releaseUrl)
            )
        )
      )
        .flat()
        .filter((release): release is Release => !is.null_(release));
      result = {
        releases,
      };
    }
    return result;
  }

  private async getChannelReleases(
    releaseUrl: string
  ): Promise<Release[] | null> {
    let result: Release[] = [];

    let raw: HttpResponse<DotnetSdkReleases> | null = null;
    try {
      raw = await this.http.getJson<DotnetSdkReleases>(releaseUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const { releases: releases } = body;
      result = releases.map((release) => {
        return {
          version: release.sdk.version,
          releaseTimestamp: release['release-date'],
        };
      });
    }

    return result;
  }
}
