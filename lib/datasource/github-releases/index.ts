import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import type {
  GetPkgReleasesConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';
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

type ChecksumAsset = {
  assetName: string;
  hashedFileName: string;
};

async function findChecksumAsset(
  release: GithubRelease | null,
  digest: string | null
): Promise<ChecksumAsset | null> {
  if (!release || !digest) {
    return null;
  }
  const smallAssets = release.assets.filter(
    (a: GithubReleaseAsset) => a.size < 5 * 1024
  );
  for (const asset of smallAssets) {
    const res = await http.get(asset.browser_download_url);
    for (const line of res.body.split('\n')) {
      const lineSplit = line.split(/\s+/, 2);
      if (lineSplit[0] === digest) {
        return {
          assetName: asset.name,
          hashedFileName: lineSplit[1],
        };
      }
    }
  }
  return null;
}

async function findNewDigest(
  currentVersion: string,
  checksumAsset: ChecksumAsset | null,
  release: GithubRelease
): Promise<string | null> {
  if (!checksumAsset) {
    return null;
  }
  const current = currentVersion.replace(/^v/, '');
  const next = release.tag_name.replace(/^v/, '');
  const releaseChecksumAssetName = checksumAsset.assetName.replaceAll(
    current,
    next
  );
  const releaseAsset = release.assets.find(
    (a: GithubReleaseAsset) => a.name === releaseChecksumAssetName
  );
  if (!releaseAsset) {
    return null;
  }
  const releaseFilename = checksumAsset.hashedFileName.replaceAll(
    current,
    next
  );
  const res = await http.get(releaseAsset.browser_download_url);
  for (const line of res.body.split('\n')) {
    const lineSplit = line.split(/\s+/, 2);
    if (lineSplit[1] === releaseFilename) {
      return lineSplit[0];
    }
  }
  return null;
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
  currentValue,
  currentDigest,
}: GetReleasesConfig & GetPkgReleasesConfig): Promise<ReleaseResult | null> {
  logger.debug(
    `getReleases(${repo}, ${registryUrl}, ${currentValue}, ${currentDigest})`
  );
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(registryUrl, repo)
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
  const url = `${apiBaseUrl}repos/${repo}/releases?per_page=100`;
  const res = await http.getJson<GithubRelease[]>(url, {
    paginate: true,
  });
  const githubReleases = res.body;
  const currentRelease = githubReleases.find(
    (r: GithubRelease) => r.tag_name === currentValue
  );
  const checksumAsset = await findChecksumAsset(currentRelease, currentDigest);
  const dependency: ReleaseResult = {
    sourceUrl: `${sourceUrlBase}${repo}`,
    releases: null,
  };
  dependency.releases = await Promise.all(
    githubReleases.map(async (release) => {
      const mapped: Release = {
        version: release.tag_name,
        gitRef: release.tag_name,
        releaseTimestamp: release.published_at,
        isStable: release.prerelease ? false : undefined,
      };

      const newDigest = await findNewDigest(
        currentValue,
        checksumAsset,
        release
      );
      if (newDigest) {
        mapped.newDigest = newDigest;
      }
      return mapped;
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
