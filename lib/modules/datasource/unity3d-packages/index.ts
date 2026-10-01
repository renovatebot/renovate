import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import * as Unity3dPackagesVersioning from '../../versioning/unity3d-packages/index.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { UnityPackageReleasesJSON } from './schema.ts';

export class Unity3dPackagesDatasource extends RegistryDatasource {
  static readonly id = 'unity3d-packages';

  static readonly defaultRegistryUrl = 'https://packages.unity.com';

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return [Unity3dPackagesDatasource.defaultRegistryUrl];
  }

  override readonly defaultVersioning = Unity3dPackagesVersioning.id;

  constructor() {
    super(Unity3dPackagesDatasource.id);
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
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

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${Unity3dPackagesDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
