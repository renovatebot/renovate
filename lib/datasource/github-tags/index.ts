import URL from 'url';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import { DigestConfig, GetReleasesConfig, ReleaseResult } from '../common';
import * as githubReleases from '../github-releases';

export const id = 'github-tags';
export const defaultRegistryUrls = ['https://github.com'];
export const registryStrategy = 'first';

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

async function getTags({
  registryUrl,
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

  let depHost = registryUrl;
  if (ensureTrailingSlash(depHost) === 'https://github.com/') {
    depHost = null;
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

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const tagsResult = await getTags(config);

  try {
    if (tagsResult?.releases) {
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
    }
  } catch (e) {
    // no-op
  }

  return tagsResult;
}
