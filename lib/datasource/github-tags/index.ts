import { api } from '../../platform/github/gh-got-wrapper';
import { ReleaseResult, GetReleasesConfig, DigestConfig } from '../common';
import { logger } from '../../logger';

const { get: ghGot } = api;

export const id = 'github-tags';

const cacheNamespace = 'datasource-github-tags';
function getCacheKey(repo: string, type: string): string {
  return `${repo}:${type}`;
}

async function getTagCommit(
  githubRepo: string,
  tag: string
): Promise<string | null> {
  const cachedResult = await renovateCache.get<string>(
    cacheNamespace,
    getCacheKey(githubRepo, `tag-${tag}`)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let digest: string;
  try {
    const url = `https://api.github.com/repos/${githubRepo}/git/refs/tags/${tag}`;
    const res = (await ghGot(url)).body.object;
    if (res.type === 'commit') {
      digest = res.sha;
    } else if (res.type === 'tag') {
      digest = (await ghGot(res.url)).body.object.sha;
    } else {
      logger.warn({ res }, 'Unknown git tag refs type');
    }
  } catch (err) {
    logger.debug(
      { githubRepo, err },
      'Error getting tag commit from GitHub repo'
    );
  }
  if (!digest) {
    return null;
  }
  const cacheMinutes = 120;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(githubRepo, `tag-${tag}`),
    digest,
    cacheMinutes
  );
  return digest;
}

/**
 * github.getDigest
 *
 * The `newValue` supplied here should be a valid tag for the docker image.
 *
 * This function will simply return the latest commit hash for the configured repository.
 */
export async function getDigest(
  { lookupName: githubRepo }: Partial<DigestConfig>,
  newValue?: string
): Promise<string | null> {
  if (newValue && newValue.length) {
    return getTagCommit(githubRepo, newValue);
  }
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(githubRepo, 'commit')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let digest: string;
  try {
    const url = `https://api.github.com/repos/${githubRepo}/commits?per_page=1`;
    digest = (await ghGot(url)).body[0].sha;
  } catch (err) {
    logger.debug(
      { githubRepo, err },
      'Error getting latest commit from GitHub repo'
    );
  }
  if (!digest) {
    return null;
  }
  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(githubRepo, 'commit'),
    digest,
    cacheMinutes
  );
  return digest;
}

/**
 * github.getPkgReleases
 *
 * This function can be used to fetch releases with a customisable versioning (e.g. semver) and with either tags or releases.
 *
 * This function will:
 *  - Fetch all tags or releases (depending on configuration)
 *  - Sanitize the versions if desired (e.g. strip out leading 'v')
 *  - Return a dependency object containing sourceUrl string and releases array
 */
export async function getPkgReleases({
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let versions: string[];
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(repo, 'tags')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    // tag
    const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;
    type GitHubTag = {
      name: string;
    }[];

    versions = (
      await ghGot<GitHubTag>(url, {
        paginate: true,
      })
    ).body.map(o => o.name);
  } catch (err) {
    logger.debug({ repo, err }, 'Error retrieving from github');
  }
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
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(repo, 'tags'),
    dependency,
    cacheMinutes
  );
  return dependency;
}
