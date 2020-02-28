import { api } from '../../platform/github/gh-got-wrapper';
import { ReleaseResult, GetReleasesConfig } from '../common';
import { logger } from '../../logger';

const { get: ghGot } = api;

const cacheNamespace = 'datasource-github-releases';

/**
 * github.getPkgReleases
 *
 * This function can be used to fetch releases with a customisable versioning (e.g. semver) and with releases.
 *
 * This function will:
 *  - Fetch all releases
 *  - Sanitize the versions if desired (e.g. strip out leading 'v')
 *  - Return a dependency object containing sourceUrl string and releases array
 */
export async function getPkgReleases({
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let versions: string[];
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    repo
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
    type GitHubRelease = {
      tag_name: string;
    }[];

    versions = (
      await ghGot<GitHubRelease>(url, {
        paginate: true,
      })
    ).body.map(o => o.tag_name);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ repo, err }, 'Error retrieving from github');
  }
  // istanbul ignore if
  if (!versions) {
    return null;
  }
  const dependency: ReleaseResult = {
    sourceUrl: 'https://github.com/' + repo,
    releases: null,
  };
  dependency.releases = versions.map(version => ({
    version,
    gitRef: version,
  }));
  const cacheMinutes = 10;
  await renovateCache.set(cacheNamespace, repo, dependency, cacheMinutes);
  return dependency;
}
