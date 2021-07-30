import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import {
  cacheNamespace,
  getApiBaseUrl,
  getSourceUrlBase,
  http,
} from './common';
import { downloadAndDigest, findDigestAsset, inferHashAlg } from './digest';
import type { DigestAsset, GithubRelease, GithubReleaseAsset } from './types';

export const id = 'github-releases';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://github.com'];
export const registryStrategy = 'first';

function getReleasesCacheKey(registryUrl: string, repo: string): string {
  const type = 'tags';
  return `${registryUrl}:${repo}:${type}`;
}

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
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheKey = getReleasesCacheKey(registryUrl, repo);
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  const apiBaseUrl = getApiBaseUrl(sourceUrlBase);
  const url = `${apiBaseUrl}repos/${repo}/releases?per_page=100`;
  const res = await http.getJson<GithubRelease[]>(url, {
    paginate: true,
  });
  const githubReleases = res.body;
  const dependency: ReleaseResult = {
    sourceUrl: `${sourceUrlBase}${repo}`,
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
  await packageCache.set(cacheNamespace, cacheKey, dependency, cacheMinutes);
  return dependency;
}

async function findNewDigest(
  digestAsset: DigestAsset,
  release: GithubRelease
): Promise<string | null> {
  const current = digestAsset.currentVersion.replace(/^v/, '');
  const next = release.tag_name.replace(/^v/, '');
  const releaseChecksumAssetName = digestAsset.assetName.replace(current, next);
  const releaseAsset = release.assets.find(
    (a: GithubReleaseAsset) => a.name === releaseChecksumAssetName
  );
  if (!releaseAsset) {
    return null;
  }
  if (digestAsset.digestedFileName) {
    const releaseFilename = digestAsset.digestedFileName.replace(current, next);
    const res = await http.get(releaseAsset.browser_download_url);
    for (const line of res.body.split('\n')) {
      const [lineDigest, lineFn] = line.split(/\s+/, 2);
      if (lineFn === releaseFilename) {
        return lineDigest;
      }
    }
  } else {
    const algorithm = inferHashAlg(digestAsset.currentDigest);
    const newDigest = await downloadAndDigest(releaseAsset, algorithm);
    return newDigest;
  }
  return null;
}

export async function getGithubRelease(
  apiBaseUrl: string,
  repo: string,
  version: string
): Promise<GithubRelease> {
  const url = `${apiBaseUrl}repos/${repo}/releases/tags/${version}`;
  const res = await http.getJson<GithubRelease>(url);
  return res.body;
}

function getDigestCacheKey(
  { lookupName: repo, currentValue, currentDigest, registryUrl }: DigestConfig,
  newValue: string
): string {
  const type = 'digest';
  return `${registryUrl}:${repo}:${currentValue}:${currentDigest}:${newValue}:${type}`;
}

/**
 * github.getDigest
 *
 * The `newValue` supplied here should be a valid tag for the GitHub release.
 * Requires `currentValue` and `currentDigest`.
 *
 * There may be many assets attached to the release. This function will:
 *  - Identify the asset pinned by `currentDigest` in the `currentValue` release
 *     - Download small release assets, parse as checksum manifests (e.g. `SHASUMS.txt`).
 *     - Download individual assets until `currentDigest` is encountered. This is limited to sha256 and sha512.
 *  - Map the hashed asset to `newValue` and return the updated digest as a string
 */
export async function getDigest(
  { lookupName: repo, currentValue, currentDigest, registryUrl }: DigestConfig,
  newValue?: string
): Promise<string | null> {
  logger.debug(
    { repo, currentValue, currentDigest, registryUrl, newValue },
    'getDigest'
  );
  if (!currentDigest) {
    return null;
  }
  if (!currentValue) {
    return currentDigest;
  }
  const cacheKey = getDigestCacheKey(
    { lookupName: repo, currentValue, currentDigest, registryUrl },
    newValue
  );
  const cachedResult = await packageCache.get<string>(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const apiBaseUrl = getApiBaseUrl(getSourceUrlBase(registryUrl));
  const currentRelease = await getGithubRelease(apiBaseUrl, repo, currentValue);
  const digestAsset = await findDigestAsset(currentRelease, currentDigest);
  let newDigest: string;
  if (!digestAsset || newValue === currentValue) {
    newDigest = currentDigest;
  } else {
    const newRelease = await getGithubRelease(apiBaseUrl, repo, newValue);
    newDigest = await findNewDigest(digestAsset, newRelease);
  }

  const cacheMinutes = 1440;
  await packageCache.set(cacheNamespace, cacheKey, newDigest, cacheMinutes);
  return newDigest;
}
