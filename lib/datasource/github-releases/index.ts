import { logger } from '../../logger';
import { api } from '../../platform/github/gh-got-wrapper';
import * as globalCache from '../../util/cache/global';
import { GetReleasesConfig, ReleaseResult } from '../common';

const { get: ghGot } = api;

export const id = 'github-releases';

const cacheNamespace = 'datasource-github-releases';

type GithubRelease = {
  tag_name: string;
  published_at: string;
};

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
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let githubReleases: GithubRelease[];
  const cachedResult = await globalCache.get<ReleaseResult>(
    cacheNamespace,
    repo
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
    const res = await ghGot<GithubRelease[]>(url, {
      paginate: true,
    });
    githubReleases = res.body;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ repo, err }, 'Error retrieving from github');
  }
  // istanbul ignore if
  if (!githubReleases) {
    return null;
  }
  const dependency: ReleaseResult = {
    sourceUrl: 'https://github.com/' + repo,
    releases: null,
  };
  dependency.releases = githubReleases.map(({ tag_name, published_at }) => ({
    version: tag_name,
    gitRef: tag_name,
    releaseTimestamp: published_at,
  }));
  const cacheMinutes = 10;
  await globalCache.set(cacheNamespace, repo, dependency, cacheMinutes);
  return dependency;
}
