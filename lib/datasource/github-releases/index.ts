import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import type { GithubRelease, GithubReleaseAsset } from './types';

export const id = 'github-releases';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://github.com'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-github-releases';

const http = new GithubHttp();

function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

function getSourceUrlBase(registryUrl: string): string {
  // default to GitHub.com if no GHE host is specified.
  return ensureTrailingSlash(registryUrl ?? 'https://github.com/');
}

function getApiBaseUrl(sourceUrlBase: string): string {
  return sourceUrlBase === 'https://github.com/'
    ? `https://api.github.com/`
    : `${sourceUrlBase}api/v3/`;
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
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(registryUrl, repo)
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
  await packageCache.set(
    cacheNamespace,
    getCacheKey(registryUrl, repo),
    dependency,
    cacheMinutes
  );
  return dependency;
}

type DigestAsset = {
  assetName: string;
  digestedFileName: string;
};

async function findDigestAsset(
  release: GithubRelease | null,
  digest: string | null
): Promise<DigestAsset | null> {
  if (!release || !digest) {
    return null;
  }
  const smallAssets = release.assets.filter(
    (a: GithubReleaseAsset) => a.size < 5 * 1024
  );
  for (const asset of smallAssets) {
    const res = await http.get(asset.browser_download_url);
    for (const line of res.body.split('\n')) {
      const [lineDigest, lineFn] = line.split(/\s+/, 2);
      if (lineDigest === digest) {
        return {
          assetName: asset.name,
          digestedFileName: lineFn,
        };
      }
    }
  }
  // TODO: it's not unreasonable to download assets to find a match
  return null;
}

async function findNewDigest(
  currentVersion: string,
  digestAsset: DigestAsset | null,
  release: GithubRelease
): Promise<string | null> {
  if (!digestAsset) {
    return null;
  }
  const current = currentVersion.replace(/^v/, '');
  const next = release.tag_name.replace(/^v/, '');
  const releaseChecksumAssetName = digestAsset.assetName.replace(current, next);
  const releaseAsset = release.assets.find(
    (a: GithubReleaseAsset) => a.name === releaseChecksumAssetName
  );
  if (!releaseAsset) {
    return null;
  }
  const releaseFilename = digestAsset.digestedFileName.replace(current, next);
  const res = await http.get(releaseAsset.browser_download_url);
  for (const line of res.body.split('\n')) {
    const [lineDigest, lineFn] = line.split(/\s+/, 2);
    if (lineFn === releaseFilename) {
      return lineDigest;
    }
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

/**
 * github.getDigest
 *
 * The `newValue` supplied here should be a valid tag for the GitHub release.
 * Requires `currentValue` and `currentDigest`.
 *
 * There may be many assets attached to the release. This function will:
 *  - Identify the asset pinned by `currentDigest` in the `currentValue` release
 *     - Download small release assets, parse as checksum manifests (e.g. `SHASUMS.txt`).
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
  // TODO: cache.get()

  const apiBaseUrl = getApiBaseUrl(getSourceUrlBase(registryUrl));
  const currentRelease = await getGithubRelease(apiBaseUrl, repo, currentValue);
  const digestAsset = await findDigestAsset(currentRelease, currentDigest);
  let newDigest: string;
  if (!digestAsset || newValue === currentValue) {
    newDigest = currentDigest;
  } else {
    const newRelease = await getGithubRelease(apiBaseUrl, repo, newValue);
    newDigest = await findNewDigest(currentValue, digestAsset, newRelease);
  }

  // TODO: cache.set()
  return newDigest;
}
