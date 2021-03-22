import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import * as githubReleases from '../github-releases';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'github-tags';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://github.com'];
export const registryStrategy = 'first';

const http = new GithubHttp();

const cacheNamespace = 'datasource-github-tags';
function getCacheKey(registryUrl: string, repo: string, type: string): string {
  return `${registryUrl}:${repo}:${type}`;
}

interface TagResponse {
  object: {
    type: string;
    url: string;
    sha: string;
  };
}

async function getTagCommit(
  registryUrl: string,
  githubRepo: string,
  tag: string
): Promise<string | null> {
  const cachedResult = await packageCache.get<string>(
    cacheNamespace,
    getCacheKey(registryUrl, githubRepo, `tag-${tag}`)
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
  let digest: string;
  try {
    const url = `${apiBaseUrl}repos/${githubRepo}/git/refs/tags/${tag}`;
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
    getCacheKey(registryUrl, githubRepo, `tag-${tag}`),
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
  { lookupName: repo, registryUrl }: Partial<DigestConfig>,
  newValue?: string
): Promise<string | null> {
  if (newValue?.length) {
    return getTagCommit(registryUrl, repo, newValue);
  }
  const cachedResult = await packageCache.get<string>(
    cacheNamespace,
    getCacheKey(registryUrl, repo, 'commit')
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
  let digest: string;
  try {
    const url = `${apiBaseUrl}repos/${repo}/commits?per_page=1`;
    const res = await http.getJson<{ sha: string }[]>(url);
    digest = res.body[0].sha;
  } catch (err) {
    logger.debug(
      { githubRepo: repo, err, registryUrl },
      'Error getting latest commit from GitHub repo'
    );
  }
  if (!digest) {
    return null;
  }
  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(registryUrl, repo, 'commit'),
    digest,
    cacheMinutes
  );
  return digest;
}

async function getTags({
  registryUrl,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(registryUrl, repo, 'tags')
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
  // tag
  const url = `${apiBaseUrl}repos/${repo}/tags?per_page=100`;
  type GitHubTag = {
    name: string;
  }[];

  const versions = (
    await http.getJson<GitHubTag>(url, {
      paginate: true,
    })
  ).body.map((o) => o.name);
  const dependency: ReleaseResult = {
    sourceUrl: `${sourceUrlBase}${repo}`,
    releases: null,
  };
  dependency.releases = versions.map((version) => ({
    version,
    gitRef: version,
  }));
  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(registryUrl, repo, 'tags'),
    dependency,
    cacheMinutes
  );
  return dependency;
}

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const tagsResult = await getTags(config);

  try {
    // Fetch additional data from releases endpoint when possible
    const releasesResult = await githubReleases.getReleases(config);
    const releaseByVersion = {};
    releasesResult?.releases?.forEach((release) => {
      const key = release.version;
      const value = { ...release };
      delete value.version;
      releaseByVersion[key] = value;
    });

    const mergedReleases = [];
    tagsResult.releases.forEach((tag) => {
      const release = releaseByVersion[tag.version];
      mergedReleases.push({ ...release, ...tag });
    });

    tagsResult.releases = mergedReleases;
  } catch (e) {
    // no-op
  }

  return tagsResult;
}
