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
    // TODO: types (#22198)
    const url = `${registryUrl}/v3/modules/${moduleSlug}?exclude_fields=current_release`;

    let module: PuppetModule;

    try {
      const response = await this.http.getJson<PuppetModule>(url);
      module = response.body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const releases: Release[] = module?.releases?.map((release) => ({
      version: release.version,
      downloadUrl: release.file_uri,
      releaseTimestamp: release.created_at,
      registryUrl,
    }));

    if (!releases?.length) {
      return null;
    }

    return PuppetForgeDatasource.createReleaseResult(releases, module);
  }

  static createReleaseResult(
    releases: Release[],
    module: PuppetModule,
  ): ReleaseResult {
    const result: ReleaseResult = {
      releases,
      homepage: module.homepage_url,
    };

    if (module.deprecated_for) {
      result.deprecationMessage = module.deprecated_for;
    }

    return result;
  }
}
