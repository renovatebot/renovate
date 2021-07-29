import hasha from 'hasha';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import type { DigestAsset, GithubRelease, GithubReleaseAsset } from './types';

export const id = 'github-releases';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://github.com'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-github-releases';

const http = new GithubHttp();

function getReleasesCacheKey(registryUrl: string, repo: string): string {
  const type = 'tags';
  return `${registryUrl}:${repo}:${type}`;
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

async function findDigestFile(
  release: GithubRelease,
  digest: string
): Promise<DigestAsset | null> {
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
          currentVersion: release.tag_name,
          currentDigest: lineDigest,
        };
      }
    }
  }
  return null;
}

function inferHashAlg(digest: string): string {
  switch (digest.length) {
    case 64:
      return 'sha256';
    default:
    case 96:
      return 'sha512';
  }
}

function getAssetDigestCacheKey(
  downloadUrl: string,
  algorithm: string
): string {
  const type = 'assetDigest';
  return `${downloadUrl}:${algorithm}:${type}`;
}

async function getAssetDigest(
  asset: GithubReleaseAsset,
  algorithm: string
): Promise<string> {
  const downloadUrl = asset.browser_download_url;
  const cacheKey = getAssetDigestCacheKey(downloadUrl, algorithm);
  const cachedResult = await packageCache.get<string>(cacheNamespace, cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const res = http.stream(downloadUrl);
  const digest = await hasha.fromStream(res, { algorithm });

  const cacheMinutes = 1440;
  await packageCache.set(cacheNamespace, cacheKey, digest, cacheMinutes);
  return digest;
}

async function findAssetWithDigest(
  release: GithubRelease,
  digest: string
): Promise<DigestAsset | null> {
  const algorithm = inferHashAlg(digest);
  const assetsBySize = release.assets.sort(
    (a: GithubReleaseAsset, b: GithubReleaseAsset) => {
      if (a.size < b.size) {
        return -1;
      }
      if (a.size > b.size) {
        return 1;
      }
      return 0;
    }
  );

  for (const asset of assetsBySize) {
    const assetDigest = await getAssetDigest(asset, algorithm);
    if (assetDigest === digest) {
      return {
        assetName: asset.name,
        currentVersion: release.tag_name,
        currentDigest: assetDigest,
      };
    }
  }
  return null;
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
    const newDigest = await getAssetDigest(releaseAsset, algorithm);
    return newDigest;
  }
  logger.debug({ releaseAsset }, 'fetch');
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
  let digestAsset = await findDigestFile(currentRelease, currentDigest);
  if (!digestAsset) {
    digestAsset = await findAssetWithDigest(currentRelease, currentDigest);
  }
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
