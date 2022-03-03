import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { OrbRelease } from './types';

const query = `
query($lookupName: String!) {
  orb(name: $lookupName) {
    name,
    homeUrl,
    versions {
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

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://circleci.com/'];

  @cache({
    namespace: `datasource-${OrbDatasource.id}`,
    key: ({ lookupName }: GetReleasesConfig) => lookupName,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const url = `${registryUrl}graphql-unstable`;
    const body = {
      query,
      variables: { lookupName },
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
    const homepage = res.homeUrl?.length
      ? res.homeUrl
      : `https://circleci.com/developer/orbs/orb/${lookupName}`;
    const releases = res.versions.map(({ version, createdAt }) => ({
      version,
      releaseTimestamp: createdAt ?? null,
    }));

    const dep = { homepage, releases };
    logger.trace({ dep }, 'dep');
    return dep;
  }
}
