import { logger } from '../../../logger';
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

    let moduleResponse;
    try {
      moduleResponse = await this.http.get(url);
    } catch (err) {
      logger.warn(
        { err },
        `ignore dependency ${packageName} because of faulty response for ${url}`
      );
      return null;
    }

    const module: PuppetModule = JSON.parse(moduleResponse.body);

    const releases: Release[] = module.releases.map((release) => ({
      version: release.version,
      downloadUrl: release.file_uri,
      releaseTimestamp: release.created_at,
      registryUrl,
    }));

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
}
