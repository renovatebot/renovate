import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { OrbResponse } from './types';

const query = `
query($packageName: String!) {
  orb(name: $packageName) {
    name,
    homeUrl,
    isPrivate,
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
      releaseTimestamp: createdAt ?? null,
    }));

    const dep = { homepage, isPrivate: !!orb.isPrivate, releases };
    logger.trace({ dep }, 'dep');
    return dep;
  }
}
