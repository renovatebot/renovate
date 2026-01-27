import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import * as glasskubeVersioning from '../../versioning/glasskube/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import {
  GlasskubePackageManifest,
  GlasskubePackageVersions,
} from './schema.ts';

export class GlasskubePackagesDatasource extends Datasource {
  static readonly id = 'glasskube-packages';
  static readonly defaultRegistryUrl =
    'https://packages.dl.glasskube.dev/packages';
  override readonly customRegistrySupport = true;
  override defaultVersioning = glasskubeVersioning.id;

  override defaultRegistryUrls = [
    GlasskubePackagesDatasource.defaultRegistryUrl,
  ];

  constructor() {
    super(GlasskubePackagesDatasource.id);
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const result: ReleaseResult = { releases: [] };

    const { val: versions, err: versionsErr } = await this.http
      .getYamlSafe(
        joinUrlParts(registryUrl!, packageName, 'versions.yaml'),
        GlasskubePackageVersions,
      )
      .unwrap();

    if (versionsErr) {
      this.handleGenericErrors(versionsErr);
    }

    result.releases = versions.versions.map((it) => ({
      version: it.version,
    }));
    result.tags = { latest: versions.latestVersion };

    const { val: latestManifest, err: latestManifestErr } = await this.http
      .getYamlSafe(
        joinUrlParts(
          registryUrl!,
          packageName,
          versions.latestVersion,
          'package.yaml',
        ),
        GlasskubePackageManifest,
      )
      .unwrap();

    if (latestManifestErr) {
      this.handleGenericErrors(latestManifestErr);
    }

    for (const ref of latestManifest?.references ?? []) {
      if (ref.label.toLowerCase() === 'github') {
        result.sourceUrl = ref.url;
      } else if (ref.label.toLowerCase() === 'website') {
        result.homepage = ref.url;
      }
    }

    return result;
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${GlasskubePackagesDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
