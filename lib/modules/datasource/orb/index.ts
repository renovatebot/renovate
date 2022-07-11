import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { OrbRelease } from './types';

const query = `
query($packageName: String!) {
  orb(name: $packageName) {
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
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const url = `${registryUrl}graphql-unstable`;
    const body = {
      query,
      variables: { packageName },
    };
    const res: OrbRelease = (
      await this.http.postJson<{ data: { orb: OrbRelease } }>(url, {
        body,
      })
    ).body.data.orb;
    if (!res) {
      logger.debug({ packageName }, 'Failed to look up orb');
      return null;
    }
    // Simplify response before caching and returning
    const homepage = res.homeUrl?.length
      ? res.homeUrl
      : `https://circleci.com/developer/orbs/orb/${packageName}`;
    const releases = res.versions.map(({ version, createdAt }) => ({
      version,
      releaseTimestamp: createdAt ?? null,
    }));

    const dep = { homepage, releases };
    logger.trace({ dep }, 'dep');
    return dep;
  }
}
