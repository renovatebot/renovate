import urljoin from 'url-join';
import { logger } from '../../../logger';
import { parseYaml } from '../../../util/yaml';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  GlasskubePackageVersions,
  GlasskubePackageManifest,
} from './types';

export class GlasskubePackagesDatasource extends Datasource {
  static readonly id = 'glasskube-packages';
  static defaultRegistryUrl = 'https://packages.dl.glasskube.dev/packages';

  override defaultRegistryUrls = [
    GlasskubePackagesDatasource.defaultRegistryUrl,
  ];

  constructor() {
    super(GlasskubePackagesDatasource.id);
  }

  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let versions: GlasskubePackageVersions;
    const result: ReleaseResult = { releases: [] };

    try {
      const response = await this.http.get(
        this.getVersionsUrl(registryUrl!, packageName),
      );
      const parsedResponse = parseYaml<GlasskubePackageVersions>(response.body);
      if (parsedResponse.length > 0) {
        versions = parsedResponse[0];
      } else {
        throw new Error('unexpected empty response');
      }
    } catch (error) {
      logger.error(
        { error, registryUrl },
        'Failed to request releases from Glasskube packages datasource',
      );
      return null;
    }

    result.releases = versions.versions.map((it) => ({
      version: it.version,
      isStable: it.version === versions.latestVersion,
      registryUrl,
    }));

    try {
      let latestManifest: GlasskubePackageManifest;
      const response = await this.http.get(
        this.getPackageManifestUrl(
          registryUrl!,
          packageName,
          versions.latestVersion,
        ),
      );
      const parsedResponse = parseYaml<GlasskubePackageManifest>(response.body);
      if (parsedResponse.length > 0) {
        latestManifest = parsedResponse[0];
      } else {
        throw new Error('unexpected empty response');
      }

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

  getVersionsUrl(registryUrl: string, packageName: string): string {
    return urljoin(registryUrl, packageName, 'versions.yaml');
  }

  getPackageManifestUrl(
    registryUrl: string,
    packageName: string,
    version: string,
  ): string {
    return urljoin(registryUrl, packageName, version, 'package.yaml');
  }
}
