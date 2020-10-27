import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'github-releases';

const cacheNamespace = 'datasource-github-releases';

const http = new GithubHttp();

type GithubRelease = {
  tag_name: string;
  published_at: string;
  prerelease: boolean;
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
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    repo
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
  const res = await http.getJson<GithubRelease[]>(url, {
    paginate: true,
  });
  const githubReleases = res.body;
  const dependency: ReleaseResult = {
    sourceUrl: 'https://github.com/' + repo,
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
  await packageCache.set(cacheNamespace, repo, dependency, cacheMinutes);
  return dependency;
}
