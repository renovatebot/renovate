import { cache } from '../../../util/cache/package/decorator';
import * as Unity3dVersioning from '../../versioning/unity3d';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { UnityReleasesJSON } from './types';

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

  static readonly id = 'unity3d';

  override readonly defaultRegistryUrls = [Unity3dDatasource.streams.lts];

  override readonly defaultVersioning = Unity3dVersioning.id;

  override readonly registryStrategy = 'merge';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `pubDate` tag in the results.';

  constructor() {
    super(Unity3dDatasource.id);
  }

  async getByStream(
    registryUrl: string | undefined,
    withHash: boolean,
  ): Promise<ReleaseResult | null> {
    const response = await this.http.getJson<UnityReleasesJSON>(registryUrl!);

    const result: ReleaseResult = {
      releases: [],
      homepage: Unity3dDatasource.homepage,
      registryUrl,
    };
    if (response.body.results) {
      response.body.results.forEach((release) => {
        result.releases.push({
          version: withHash
            ? `${release.version} (${release.shortRevision})`
            : release.version,
          releaseTimestamp: release.releaseDate,
          changelogUrl: release.releaseNotes.url,
          isStable: registryUrl === Unity3dDatasource.streams.lts,
          registryUrl,
        });
      });
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
