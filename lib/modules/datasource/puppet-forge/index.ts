import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { PUPPET_FORGE } from './common.ts';
import { PuppetModule } from './schema.ts';

export class PuppetForgeDatasource extends Datasource {
  static id = 'puppet-forge';

  constructor() {
    super(PuppetForgeDatasource.id);
  }

  override readonly defaultRegistryUrls = [PUPPET_FORGE];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field from the response.';

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // https://forgeapi.puppet.com
    const moduleSlug = packageName.replace('/', '-');
    const url = `${registryUrl}/v3/modules/${moduleSlug}?exclude_fields=current_release`;

    let result: ReleaseResult;

    try {
      const response = await this.http.getJson(url, PuppetModule);
      result = response.body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    if (!result.releases.length) {
      return null;
    }

    for (const release of result.releases) {
      release.registryUrl = registryUrl;
    }

    return result;
  }
}
