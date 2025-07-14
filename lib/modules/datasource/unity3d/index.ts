import { cache } from '../../../util/cache/package/decorator';
import { asTimestamp } from '../../../util/timestamp';
import * as Unity3dVersioning from '../../versioning/unity3d';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { UnityReleasesJSON } from './schema';

export class Unity3dDatasource extends Datasource {
  static readonly baseUrl =
    'https://services.api.unity.com/unity/editor/release/v1/releases';
  static readonly homepage = 'https://unity.com/';
  static readonly streams: Record<string, string> = {
    lts: `${Unity3dDatasource.baseUrl}?stream=LTS`,
    tech: `${Unity3dDatasource.baseUrl}?stream=TECH`,
    alpha: `${Unity3dDatasource.baseUrl}?stream=ALPHA`,
    beta: `${Unity3dDatasource.baseUrl}?stream=BETA`,
  };
  static readonly legacyStreams: Record<string, string> = {
    lts: `${Unity3dDatasource.homepage}releases/editor/lts-releases.xml`,
    stable: `${Unity3dDatasource.homepage}releases/editor/releases.xml`,
    beta: `${Unity3dDatasource.homepage}releases/editor/beta/latest.xml`,
  };
  static readonly limit: number = 25;

  static readonly id = 'unity3d';

  override readonly defaultRegistryUrls = [Unity3dDatasource.streams.lts];

  override readonly defaultVersioning = Unity3dVersioning.id;

  override readonly registryStrategy = 'merge';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `releaseDate` field in the results.';

  constructor() {
    super(Unity3dDatasource.id);
  }

  translateStream(registryUrl: string): string {
    const legacyKey = Object.keys(Unity3dDatasource.legacyStreams).find(
      (key) => Unity3dDatasource.legacyStreams[key] === registryUrl,
    );

    if (legacyKey) {
      if (legacyKey === 'stable') {
        return Unity3dDatasource.streams.lts;
      }

      return Unity3dDatasource.streams[legacyKey];
    }

    return registryUrl;
  }

  async getByStream(
    registryUrl: string | undefined,
    withHash: boolean,
  ): Promise<ReleaseResult | null> {
    const translatedRegistryUrl = this.translateStream(registryUrl!);

    const isStable: boolean =
      translatedRegistryUrl === Unity3dDatasource.streams.lts;

    let total: number | null = null;

    const result: ReleaseResult = {
      releases: [],
      homepage: Unity3dDatasource.homepage,
      registryUrl: translatedRegistryUrl,
    };

    for (
      let offset = 0;
      total === null || offset < total;
      offset += Unity3dDatasource.limit
    ) {
      const response = await this.http.getJson(
        `${translatedRegistryUrl}&limit=${Unity3dDatasource.limit}&offset=${offset}`,
        UnityReleasesJSON,
      );

      for (const release of response.body.results) {
        result.releases.push({
          version: withHash
            ? `${release.version} (${release.shortRevision})`
            : release.version,
          releaseTimestamp: asTimestamp(release.releaseDate),
          changelogUrl: release.releaseNotes.url,
          isStable,
        });
      }

      total ??= response.body.total;
    }

    return result;
  }

  @cache({
    namespace: `datasource-${Unity3dDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    return await this.getByStream(
      registryUrl,
      packageName === 'm_EditorVersionWithRevision',
    );
  }
}
