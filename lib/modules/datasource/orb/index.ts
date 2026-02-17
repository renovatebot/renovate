import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import type { OrbResponse } from './types.ts';

const MAX_VERSIONS = 100;

const query = `
query($packageName: String!, $maxVersions: Int!) {
  orb(name: $packageName) {
    name,
    homeUrl,
    isPrivate,
    versions(count: $maxVersions) {
      version,
      createdAt
    }
  }
}
`;

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
    'The release timestamp is determined from the `createdAt` field in the results.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }
    const url = joinUrlParts(registryUrl, 'graphql-unstable');
    const body = {
      query,
      variables: { packageName, maxVersions: MAX_VERSIONS },
    };
    const res = (
      await this.http.postJson<OrbResponse>(url, {
        body,
      })
    ).body;
    if (!res?.data?.orb) {
      logger.debug({ res }, `Failed to look up orb ${packageName}`);
      return null;
    }

    const { orb } = res.data;
    // Simplify response before caching and returning
    const homepage = orb.homeUrl?.length
      ? orb.homeUrl
      : `https://circleci.com/developer/orbs/orb/${packageName}`;
    const releases = orb.versions.map(({ version, createdAt }) => ({
      version,
      releaseTimestamp: asTimestamp(createdAt),
    }));

    const dep = { homepage, isPrivate: !!orb.isPrivate, releases };
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
