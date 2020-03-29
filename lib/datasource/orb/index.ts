import { logger } from '../../logger';
import got from '../../util/got';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'orb';

interface OrbRelease {
  homeUrl?: string;
  versions: {
    version: string;
    createdAt?: string;
  }[];
}

/**
 * orb.getPkgReleases
 *
 * This function will fetch an orb from CircleCI and return all semver versions.
 */
export async function getPkgReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  logger.debug({ lookupName }, 'orb.getPkgReleases()');
  const cacheNamespace = 'orb';
  const cacheKey = lookupName;
  const cachedResult = await renovateCache.get<ReleaseResult>(
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
  try {
    const res: OrbRelease = (
      await got.post(url, {
        body,
        hostType: id,
        json: true,
        retry: 5,
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
    if (res.homeUrl && res.homeUrl.length) {
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
    await renovateCache.set(cacheNamespace, cacheKey, dep, cacheMinutes);
    return dep;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'CircleCI Orb lookup error');
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug({ lookupName }, `CircleCI Orb lookup failure: not found`);
      return null;
    }
    logger.warn({ lookupName }, 'CircleCI Orb lookup failure: Unknown error');
    return null;
  }
}
