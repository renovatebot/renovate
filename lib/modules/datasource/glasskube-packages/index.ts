import { logger } from '../../../logger';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  GlasskubePackageManifestYaml,
  GlasskubePackageVersions,
  GlasskubePackageVersionsYaml,
} from './schema';

export class GlasskubePackagesDatasource extends Datasource {
  static readonly id = 'glasskube-packages';
  static readonly defaultRegistryUrl =
    'https://packages.dl.glasskube.dev/packages';

  override defaultRegistryUrls = [
    GlasskubePackagesDatasource.defaultRegistryUrl,
  ];

  constructor() {
    super(GlasskubePackagesDatasource.id);
  }

  @cache({
    namespace: `datasource-${GlasskubePackagesDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `${packageName}`,
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
    } catch (error) {
      logger.error(
        { error, registryUrl },
        'Failed to request releases from Glasskube packages datasource',
      );
      return null;
    }

    result.releases = versions.versions.map((it) => ({
      version: it.version,
      registryUrl,
    }));

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
    } catch (error) {
      logger.error(
        { error, registryUrl },
        'Failed to request latest release from Glasskube packages datasource',
      );
    }

    return result;
  }
}
