import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { getQueryString, joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import type { OrbPackagesResponse } from './types.ts';

export class OrbDatasource extends Datasource {
  static readonly id = 'orb';

  constructor() {
    super(OrbDatasource.id);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = ['https://circleci.com/'];
  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field in the results.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }
    const url = `${joinUrlParts(
      registryUrl,
      'api/v3/orb/packages',
    )}?${getQueryString({ 'filter[name]': packageName })}`;
    const res = (await this.http.getJsonUnchecked<OrbPackagesResponse>(url))
      .body;
    const pkg = res?.data?.[0];
    if (!pkg) {
      logger.debug({ packageName }, `Failed to look up orb ${packageName}`);
      return null;
    }

    // Simplify response before caching and returning
    const homepage = pkg.attributes.home_url?.length
      ? pkg.attributes.home_url
      : `https://circleci.com/developer/orbs/orb/${packageName}`;
    const releases = (pkg.references?.orb_versions ?? []).map(
      ({ attributes }) => ({
        version: attributes.version,
        releaseTimestamp: asTimestamp(attributes.created_at),
      }),
    );

    const dep = { homepage, isPrivate: !!pkg.attributes.is_private, releases };
    logger.trace({ dep }, 'dep');
    return dep;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${OrbDatasource.id}`,
        key: config.packageName,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
