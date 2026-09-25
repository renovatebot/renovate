import urlJoin from 'url-join';
import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { RegistryDatasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { BuildpacksRegistryResponse } from './schema.ts';

export class BuildpacksRegistryDatasource extends RegistryDatasource {
  static readonly id = 'buildpacks-registry';

  constructor() {
    super(BuildpacksRegistryDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://registry.buildpacks.io'];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `source_code_url` field of the release object in the results.';

  private async _getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    const url = urlJoin(registryUrl, 'api', 'v1', 'buildpacks', packageName);

    const body = await this.fetchJsonOrNull(url, BuildpacksRegistryResponse);
    if (!body) {
      return null;
    }

    const { versions, latest } = body;
    const releases: Release[] = versions;

    const res: ReleaseResult = { releases };

    if (latest?.homepage) {
      res.homepage = latest.homepage;
    }

    return res;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${BuildpacksRegistryDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        cacheable: true,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
