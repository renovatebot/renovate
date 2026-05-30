import { asTimestamp } from '../../../util/timestamp.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { PUPPET_FORGE } from './common.ts';
import { PuppetModuleSchema } from './schema.ts';

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

    let module: PuppetModuleSchema;

    try {
      const response = await this.http.getJson(url, PuppetModuleSchema);
      module = response.body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const releases: Release[] = module?.releases?.map((release) => ({
      version: release.version,
      downloadUrl: release.file_uri,
      releaseTimestamp: asTimestamp(release.created_at),
      registryUrl,
    }));

    if (!releases?.length) {
      return null;
    }

    return PuppetForgeDatasource.createReleaseResult(releases, module);
  }

  static createReleaseResult(
    releases: Release[],
    module: PuppetModuleSchema,
  ): ReleaseResult {
    const result: ReleaseResult = {
      releases,
      // the homepage url in the fixtures is a github repo, we can use this as sourceUrl
      homepage: module.homepage_url,
    };

    if (module.deprecated_for) {
      result.deprecationMessage = module.deprecated_for;
    }

    return result;
  }
}
