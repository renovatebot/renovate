import { cache } from '../../../util/cache/package/decorator';
import { asTimestamp } from '../../../util/timestamp';
import * as Unity3dPackagesVersioning from '../../versioning/unity3d-packages';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { UnityPackageReleasesJSON } from './schema';

export class Unity3dPackagesDatasource extends Datasource {
  static readonly id = 'unity3d-packages';

  static readonly defaultRegistryUrl = 'https://packages.unity.com';

  override readonly defaultRegistryUrls = [
    Unity3dPackagesDatasource.defaultRegistryUrl,
  ];

  override readonly defaultVersioning = Unity3dPackagesVersioning.id;

  constructor() {
    super(Unity3dPackagesDatasource.id);
  }

  @cache({
    namespace: `datasource-${Unity3dPackagesDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const response = await this.http.getJson(
      `${registryUrl}/${packageName}`,
      UnityPackageReleasesJSON,
    );

    const usingDefaultRegistry =
      registryUrl === Unity3dPackagesDatasource.defaultRegistryUrl;
    const versions = Object.values(response.body.versions);

    const result: ReleaseResult = {
      releases: [],
      homepage: versions?.[0]?.documentationUrl,
      registryUrl,
      sourceUrl: versions?.[0]?.repository?.url,
    };

    for (const release of versions) {
      result.releases.push({
        version: release.version,
        releaseTimestamp: asTimestamp(response.body.time[release.version]),
        changelogContent: release._upm?.changelog,
        changelogUrl: usingDefaultRegistry
          ? release.documentationUrl?.replace(
              'manual/index.html',
              'changelog/CHANGELOG.html',
            )
          : undefined,
        isStable: Unity3dPackagesVersioning.default.isStable(release.version),
        registryUrl,
      });
    }

    return result;
  }
}
