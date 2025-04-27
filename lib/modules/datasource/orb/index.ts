import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { asTimestamp } from '../../../util/timestamp';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { OrbResponse } from './types';

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

  @cache({
    namespace: `datasource-${OrbDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
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
}
