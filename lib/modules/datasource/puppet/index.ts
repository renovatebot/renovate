import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { PuppetModule } from './types';

export class PuppetDatasource extends Datasource {
  static id = 'puppet';

  constructor() {
    super(PuppetDatasource.id);
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // https://forgeapi.puppet.com
    const moduleSlug = packageName.replace('/', '-');
    const moduleResponse = await this.http.get(
      `${registryUrl}/v3/modules/${moduleSlug}`
    );

    if (moduleResponse.statusCode !== 200) {
      return null;
    }

    const module: PuppetModule = JSON.parse(moduleResponse.body);

    const releases: Release[] = module.releases.map((release) => ({
      version: release.version,
      downloadUrl: release.file_uri,
      releaseTimestamp: release.created_at,
      registryUrl: release.uri,
    }));

    const releaseResult: ReleaseResult = {
      releases,
      deprecationMessage: module.deprecated_for,
      homepage: module.homepage_url,
      tags: {
        // is this the correct use of tags?
        endorsement: module.endorsement,
        moduleGroup: module.module_group,
        premium: `${module.premium}`,
      },
    };

    return releaseResult;
  }
}
