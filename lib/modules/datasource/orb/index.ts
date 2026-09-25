import { logger } from '../../../logger/index.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { getQueryString, joinUrlParts } from '../../../util/url.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { OrbPackagesResponse } from './schema.ts';

export class OrbDatasource extends RegistryDatasource {
  static readonly id = 'orb';

  constructor() {
    super(OrbDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://circleci.com/'];
  }
  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field in the results.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${joinUrlParts(
      registryUrl,
      'api/v3/orb/packages',
    )}?${getQueryString({ 'filter[name]': packageName })}`;
    const body = await this.fetchJson(url, OrbPackagesResponse);
    const pkg = body.data[0];
    if (!pkg) {
      logger.debug({ packageName }, `Failed to look up orb ${packageName}`);
      return null;
    }

    // The homepage fallback uses the requested packageName, which the schema
    // has no access to, so it is built here rather than in the transform.
    const homepage = pkg.homeUrl?.length
      ? pkg.homeUrl
      : `https://circleci.com/developer/orbs/orb/${packageName}`;
    const dep = {
      homepage,
      isPrivate: pkg.isPrivate,
      releases: pkg.releases,
    };
    logger.trace({ dep }, 'dep');
    return dep;
  }

  override getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${OrbDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
