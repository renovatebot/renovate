import { api } from '../../platform/github/gh-got-wrapper';
import {
  ReleaseResult,
  PkgReleaseConfig,
  Preset,
  DigestConfig,
} from '../common';
import { logger } from '../../logger';
import got, { GotJSONOptions } from '../../util/got';

const ghGot = api.get;

async function fetchJSONFile(repo: string, fileName: string): Promise<Preset> {
  const url = `https://api.github.com/repos/${repo}/contents/${fileName}`;
  const opts: GotJSONOptions = {
    headers: {
      accept: global.appMode
        ? 'application/vnd.github.machine-man-preview+json'
        : 'application/vnd.github.v3+json',
    },
    json: true,
    hostType: 'github',
  };
  let res: { body: { content: string } };
  try {
    res = await got(url, opts);
  } catch (err) {
    if (err.message === 'platform-failure') {
      throw err;
    }
    logger.debug(
      { statusCode: err.statusCodef },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error('dep not found');
  }
  try {
    const content = Buffer.from(res.body.content, 'base64').toString();
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    throw new Error('invalid preset JSON');
  }
}

export async function getPreset(
  pkgName: string,
  presetName = 'default'
): Promise<Preset> {
  if (presetName === 'default') {
    try {
      const defaultJson = await fetchJSONFile(pkgName, 'default.json');
      return defaultJson;
    } catch (err) {
      if (err.message === 'platform-failure') {
        throw err;
      }
      if (err.message === 'dep not found') {
        logger.info('default.json preset not found - trying renovate.json');
        return fetchJSONFile(pkgName, 'renovate.json');
      }
      throw err;
    }
  }
  return fetchJSONFile(pkgName, `${presetName}.json`);
}

const cacheNamespace = 'datasource-github';
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
    logger.info(
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
    logger.info(
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
 * This function can be used to fetch releases with a customisable version scheme (e.g. semver) and with either tags or releases.
 *
 * This function will:
 *  - Fetch all tags or releases (depending on configuration)
 *  - Sanitize the versions if desired (e.g. strip out leading 'v')
 *  - Return a dependency object containing sourceUrl string and releases array
 */
export async function getPkgReleases({
  lookupName: repo,
  lookupType,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  let versions: string[];
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(repo, lookupType || 'tags')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    if (lookupType === 'releases') {
      const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
      type GitHubRelease = {
        tag_name: string;
      }[];

      versions = (await ghGot<GitHubRelease>(url, {
        paginate: true,
      })).body.map(o => o.tag_name);
    } else {
      // tag
      const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;
      type GitHubTag = {
        name: string;
      }[];

      versions = (await ghGot<GitHubTag>(url, {
        paginate: true,
      })).body.map(o => o.name);
    }
  } catch (err) {
    logger.info({ repo, err }, 'Error retrieving from github');
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
    getCacheKey(repo, lookupType),
    dependency,
    cacheMinutes
  );
  return dependency;
}
