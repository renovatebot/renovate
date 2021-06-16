import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { OrbRelease } from './types';

export class OrbDatasource extends Datasource {
  static readonly id = 'orb';

  constructor() {
    super(OrbDatasource.id);
  }

  customRegistrySupport = false;

  defaultRegistryUrls = ['https://circleci.com/'];

  @cache({
    namespace: `datasource-${OrbDatasource.id}`,
    key: ({ lookupName }: GetReleasesConfig) => lookupName,
    ttlMinutes: 15,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${registryUrl}graphql-unstable`;
    const body = {
      query: `{orb(name:"${lookupName}"){name, homeUrl, versions {version, createdAt}}}`,
      variables: {},
    };
    const res: OrbRelease = (
      await this.http.postJson<{ data: { orb: OrbRelease } }>(url, {
        body,
      })
    ).body.data.orb;
    if (!res) {
      logger.debug({ lookupName }, 'Failed to look up orb');
      return null;
    }
    // Simplify response before caching and returning
    const dep: ReleaseResult = {
      releases: null,
    };
    if (res.homeUrl?.length) {
      dep.homepage = res.homeUrl;
    }
    dep.homepage =
      dep.homepage || `https://circleci.com/developer/orbs/orb/${lookupName}`;
    dep.releases = res.versions.map(({ version, createdAt }) => ({
      version,
      releaseTimestamp: createdAt || null,
    }));

    logger.trace({ dep }, 'dep');
    return dep;
  }
}
