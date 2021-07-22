import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import type {
  GetReleasesConfig,
  GetPkgReleasesConfig,
  ReleaseResult,
} from '../types';
import type { GithubRelease } from './types';
import { logger } from '../../logger';

export const id = 'github-releases';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://github.com'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-github-releases';

const http = new GithubHttp();

function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

/**
 * github.getReleases
 *
 * This function can be used to fetch releases with a customisable versioning (e.g. semver) and with releases.
 *
 * This function will:
 *  - Fetch all releases
 *  - Sanitize the versions if desired (e.g. strip out leading 'v')
 *  - Return a dependency object containing sourceUrl string and releases array
 */
export async function getReleases({
  lookupName: repo,
  registryUrl,
  currentValue,
  currentDigest,
}: GetReleasesConfig & GetPkgReleasesConfig): Promise<ReleaseResult | null> {
  logger.debug(
    `getReleases(${repo}, ${registryUrl}, ${currentValue}, ${currentDigest})`
  );
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(registryUrl, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  // default to GitHub.com if no GHE host is specified.
  const sourceUrlBase = ensureTrailingSlash(
    registryUrl ?? 'https://github.com/'
  );
  const apiBaseUrl =
    sourceUrlBase === 'https://github.com/'
      ? `https://api.github.com/`
      : `${sourceUrlBase}api/v3/`;
  const url = `${apiBaseUrl}repos/${repo}/releases?per_page=100`;
  const res = await http.getJson<GithubRelease[]>(url, {
    paginate: true,
  });
  const githubReleases = res.body;
  const dependency: ReleaseResult = {
    sourceUrl: `${sourceUrlBase}${repo}`,
    releases: null,
  };
  dependency.releases = githubReleases.map(
    ({ tag_name, published_at, prerelease }) => ({
      version: tag_name,
      gitRef: tag_name,
      releaseTimestamp: published_at,
      isStable: prerelease ? false : undefined,
    })
  );
  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(registryUrl, repo),
    dependency,
    cacheMinutes
  );
  return dependency;
}
