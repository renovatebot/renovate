import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'orb';

const http = new Http(id);

interface OrbRelease {
  homeUrl?: string;
  versions: {
    version: string;
    createdAt?: string;
  }[];
}

/**
 * orb.getReleases
 *
 * This function will fetch an orb from CircleCI and return all semver versions.
 */
export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  logger.debug({ lookupName }, 'orb.getReleases()');
  const cacheNamespace = 'orb';
  const cacheKey = lookupName;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const url = 'https://circleci.com/graphql-unstable';
  const body = {
    query: `{orb(name:"${lookupName}"){name, homeUrl, versions {version, createdAt}}}`,
    variables: {},
  };
  const res: OrbRelease = (
    await http.postJson<{ data: { orb: OrbRelease } }>(url, {
      body,
    })
  ).body.data.orb;
  if (!res) {
    logger.debug({ lookupName }, 'Failed to look up orb');
    return null;
  }
  // Simplify response before caching and returning
  const dep: ReleaseResult = {
    name: lookupName,
    versions: {},
    releases: null,
  };
  if (res.homeUrl?.length) {
    dep.homepage = res.homeUrl;
  }
  dep.homepage =
    dep.homepage || `https://circleci.com/orbs/registry/orb/${lookupName}`;
  dep.releases = res.versions.map(({ version, createdAt }) => ({
    version,
    releaseTimestamp: createdAt || null,
  }));
  logger.trace({ dep }, 'dep');
  const cacheMinutes = 15;
  await packageCache.set(cacheNamespace, cacheKey, dep, cacheMinutes);
  return dep;
}
