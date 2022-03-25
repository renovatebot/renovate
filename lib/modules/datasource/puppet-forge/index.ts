import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { PUPPET_FORGE } from './common';
import type { PuppetModule } from './types';

export class PuppetForgeDatasource extends Datasource {
  static id = 'puppet-forge';

  constructor() {
    super(PuppetForgeDatasource.id);
  }

  override readonly defaultRegistryUrls = [PUPPET_FORGE];

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // https://forgeapi.puppet.com
    const moduleSlug = packageName.replace('/', '-');
    const url = `${registryUrl}/v3/modules/${moduleSlug}?exclude_fields=current_release`;

    const { body: module } = await this.http.getJson<PuppetModule>(url);

    const releases: Release[] = module.releases.map((release) => ({
      version: release.version,
      downloadUrl: release.file_uri,
      releaseTimestamp: release.created_at,
      registryUrl,
    }));

    if (!releases.length) {
      return null;
    }

    return createReleaseResult(releases, module);
  }
}

function createReleaseResult(
  releases: Release[],
  module: PuppetModule
): ReleaseResult {
  const result: ReleaseResult = {
    releases,
    homepage: module.homepage_url,
    tags: {
      moduleGroup: module.module_group,
      premium: `${module.premium}`,
    },
  };

  if (module.deprecated_for) {
    result.deprecationMessage = module.deprecated_for;
  }

  if (result.tags && module.endorsement) {
    result.tags.endorsement = module.endorsement;
  }

  return result;
}
