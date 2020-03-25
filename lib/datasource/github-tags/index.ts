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

type ReleaseTimestamps = Record<string, string | null>;

async function fetchReleaseTimestamps(
  repo: string,
  tags: GithubTag[]
): Promise<ReleaseTimestamps> | null {
  const result: ReleaseTimestamps = {};

  const queue = tags.map(tag => async (): Promise<void> => {
    const commitHash = tag?.commit?.sha;

    const commitUrl = tag?.commit?.url;
    let releaseTimestamp = null;
    if (commitUrl && commitHash) {
      try {
        const res = await ghGot<GithubCommit>(commitUrl);
        releaseTimestamp = res.body.commit?.author?.date;
      } catch (err) {
        logger.debug({ repo, err }, 'Error retrieving github commit');
      }
    }
    result[commitHash] = releaseTimestamp;
  });

  await pAll(queue, { concurrency: 5 });

  return result;
}

function tagsToReleases(
  tags: GithubTag[],
  timestamps: ReleaseTimestamps,
  ignoreMissing = true
): Release[] | null {
  let missingTag = false;
  const result: Release[] = tags.map(tag => {
    const version = tag.name;
    const gitRef = version;
    const commitHash = tag.commit?.sha;
    if (commitHash) {
      const releaseTimestamp = timestamps[commitHash];
      if (releaseTimestamp === undefined) {
        missingTag = true;
      }
      if (releaseTimestamp) {
        return { gitRef, version, releaseTimestamp };
      }
    }
    return { gitRef, version };
  });

  return !ignoreMissing && missingTag ? null : result;
}

async function getReleasesWithTimestamp(
  repo: string,
  tags: GithubTag[] | null
): Promise<Release[]> | null {
  const repoCacheKey = getCacheKey(repo, 'release-timestamps');
  const cachedTimestamps = await renovateCache.get<ReleaseTimestamps>(
    cacheNamespace,
    repoCacheKey
  );

  const freshReleases = async (): Promise<Release[]> => {
    const fetchedTimestamps = await fetchReleaseTimestamps(repo, tags);
    await renovateCache.set<ReleaseTimestamps>(
      cacheNamespace,
      getCacheKey(repo, 'release-timestamps'),
      fetchedTimestamps,
      2 * 24 * 60
    );
    return tagsToReleases(tags, fetchedTimestamps);
  };

  if (!cachedTimestamps) {
    return freshReleases();
  }

  const cacheBasedResult = tagsToReleases(tags, cachedTimestamps, false);
  if (!cacheBasedResult) {
    return freshReleases();
  }
  return cacheBasedResult;
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
