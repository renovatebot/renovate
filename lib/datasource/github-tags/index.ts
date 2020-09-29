import URL from 'url';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
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
  const cachedResult = await packageCache.get<string>(
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
  await packageCache.set(
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
  if (newValue?.length) {
    return getTagCommit(githubRepo, newValue);
  }
  const cachedResult = await packageCache.get<string>(
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
  await packageCache.set(
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
  registryUrl: depHost,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(repo, 'tags')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  // default to GitHub.com if no GHE host is specified.
  const sourceUrlBase = depHost ?? `https://github.com/`;
  const apiBaseUrl = depHost
    ? URL.resolve(depHost, 'api/v3/')
    : `https://api.github.com/`;

  // tag
  const url = URL.resolve(apiBaseUrl, `repos/${repo}/tags?per_page=100`);
  type GitHubTag = {
    name: string;
  }[];

  const versions = (
    await http.getJson<GitHubTag>(url, {
      paginate: true,
    })
  ).body.map((o) => o.name);
  const dependency: ReleaseResult = {
    sourceUrl: URL.resolve(sourceUrlBase, repo),
    releases: null,
  };
  dependency.releases = versions.map((version) => ({
    version,
    gitRef: version,
  }));
  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(repo, 'tags'),
    dependency,
    cacheMinutes
  );
  return dependency;
}
