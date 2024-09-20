import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import * as glasskubeVersioning from '../../versioning/glasskube';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { GlasskubePackageVersions } from './schema';
import {
  GlasskubePackageManifestYaml,
  GlasskubePackageVersionsYaml,
} from './schema';

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

  @cache({
    namespace: `datasource-${GlasskubePackagesDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let versions: GlasskubePackageVersions;
    const result: ReleaseResult = { releases: [] };

    try {
      const response = await this.http.get(
        joinUrlParts(registryUrl!, packageName, 'versions.yaml'),
      );
      versions = GlasskubePackageVersionsYaml.parse(response.body);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    result.releases = versions.versions.map((it) => ({
      version: it.version,
    }));
    result.tags = { latest: versions.latestVersion };

    try {
      const response = await this.http.get(
        joinUrlParts(
          registryUrl!,
          packageName,
          versions.latestVersion,
          'package.yaml',
        ),
      );
      const latestManifest = GlasskubePackageManifestYaml.parse(response.body);
      for (const ref of latestManifest?.references ?? []) {
        if (ref.label.toLowerCase() === 'github') {
          result.sourceUrl = ref.url;
        } else if (ref.label.toLowerCase() === 'website') {
          result.homepage = ref.url;
        }
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result;
  }
}
