import pAll from 'p-all';
import { api } from '../../platform/github/gh-got-wrapper';
import {
  ReleaseResult,
  GetReleasesConfig,
  DigestConfig,
  Release,
} from '../common';
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

type GithubTag = {
  name: string;
  commit?: {
    sha?: string;
    url?: string;
  };
};

type GithubCommit = {
  commit?: {
    author?: {
      date?: string;
    };
  };
};

type GithubCommitTimestamps = Record<string, string | null>;

async function getReleasesWithTimestamp(
  repo: string,
  tags: GithubTag[] | null
): Promise<Release[]> | null {
  const result: Release[] = [];

  const cached =
    (await renovateCache.get<GithubCommitTimestamps>(
      cacheNamespace,
      getCacheKey(repo, 'commit-timestamps')
    )) || {};

  let updateCache = false;

  const queue = tags.map(tag => async (): Promise<void> => {
    const release: Release = {
      version: tag.name,
      gitRef: tag.name,
    };

    const commitHash = tag?.commit?.sha;

    const setReleaseTimestamp = (releaseTimestamp: string): void => {
      cached[commitHash] = releaseTimestamp;
      if (releaseTimestamp) {
        release.releaseTimestamp = releaseTimestamp;
      }
      result.push(release);
    };

    const commitUrl = tag?.commit?.url;

    if (commitUrl && commitHash) {
      if (cached[commitHash] !== undefined) {
        return setReleaseTimestamp(cached[commitHash]);
      }

      updateCache = true;
      try {
        const res = await ghGot<GithubCommit>(commitUrl, {
          paginate: true,
        });
        const releaseTimestamp = res.body.commit?.author?.date;
        return setReleaseTimestamp(releaseTimestamp);
      } catch (err) {
        logger.debug({ repo, err }, 'Error retrieving github commit');
      }
    }
    return setReleaseTimestamp(null);
  });

  await pAll(queue, { concurrency: 5 });

  if (updateCache) {
    await renovateCache.set<GithubCommitTimestamps>(
      cacheNamespace,
      getCacheKey(repo, 'commit-timestamps'),
      cached,
      2 * 24 * 60
    );
  }

  return result;
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
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(repo, 'tags')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let tags: GithubTag[];
  try {
    // tag
    const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;

    const res = await ghGot<GithubTag[]>(url, {
      paginate: true,
    });
    tags = res.body;
  } catch (err) {
    logger.debug({ repo, err }, 'Error retrieving from github');
  }
  if (!tags) {
    return null;
  }

  const releases = await getReleasesWithTimestamp(repo, tags);
  const dependency: ReleaseResult = {
    sourceUrl: 'https://github.com/' + repo,
    releases,
  };

  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(repo, 'tags'),
    dependency,
    cacheMinutes
  );
  return dependency;
}
