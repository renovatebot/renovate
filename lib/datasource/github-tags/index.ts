import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import { GithubHttp } from '../../util/http/github';
import { DigestConfig, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'github-tags';

const http = new GithubHttp();

const cacheNamespace = 'datasource-github-tags';
function getCacheKey(repo: string, type: string): string {
  return `${repo}:${type}`;
}

interface TagResponse {
  object: {
    type: string;
    url: string;
    sha: string;
  };
}

async function getTagCommit(
  githubRepo: string,
  tag: string
): Promise<string | null> {
  const cachedResult = await globalCache.get<string>(
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
    const res = (await http.getJson<TagResponse>(url)).body.object;
    if (res.type === 'commit') {
      digest = res.sha;
    } else if (res.type === 'tag') {
      digest = (await http.getJson<TagResponse>(res.url)).body.object.sha;
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
  await globalCache.set(
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
  const cachedResult = await globalCache.get(
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
    const res = await http.getJson<{ sha: string }[]>(url);
    digest = res.body[0].sha;
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
  await globalCache.set(
    cacheNamespace,
    getCacheKey(githubRepo, 'commit'),
    digest,
    cacheMinutes
  );
  return digest;
}

/**
 * github.getReleases
 *
 * This function can be used to fetch releases with a customisable versioning (e.g. semver) and with either tags or releases.
 *
 * This function will:
 *  - Fetch all tags or releases (depending on configuration)
 *  - Sanitize the versions if desired (e.g. strip out leading 'v')
 *  - Return a dependency object containing sourceUrl string and releases array
 */
export async function getReleases({
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let versions: string[];
  const cachedResult = await globalCache.get<ReleaseResult>(
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
      await http.getJson<GitHubTag>(url, {
        paginate: true,
      })
    ).body.map((o) => o.name);
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
  dependency.releases = versions.map((version) => ({
    version,
    gitRef: version,
  }));
  const cacheMinutes = 10;
  await globalCache.set(
    cacheNamespace,
    getCacheKey(repo, 'tags'),
    dependency,
    cacheMinutes
  );
  return dependency;
}
