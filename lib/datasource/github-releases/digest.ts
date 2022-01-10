import hasha from 'hasha';
import * as packageCache from '../../util/cache/package';
import { regEx } from '../../util/regex';
import { cacheNamespace, http } from './common';
import type { DigestAsset, GithubRelease, GithubReleaseAsset } from './types';

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
      const [lineDigest, lineFn] = line.split(regEx(/\s+/), 2);
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

async function downloadAndDigest(
  asset: GithubReleaseAsset,
  algorithm: string
): Promise<string> {
  const downloadUrl = asset.browser_download_url;
  const cacheKey = getAssetDigestCacheKey(downloadUrl, algorithm);
  const cachedResult = await packageCache.get<string>(cacheNamespace, cacheKey);
  // istanbul ignore if
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
    const assetDigest = await downloadAndDigest(asset, algorithm);
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

/** Identify the asset associated with a known digest. */
export async function findDigestAsset(
  release: GithubRelease,
  digest: string
): Promise<DigestAsset> {
  const digestFile = await findDigestFile(release, digest);
  if (digestFile) {
    return digestFile;
  }

  const asset = await findAssetWithDigest(release, digest);
  return asset;
}

/** Given a digest asset, find the equivalent digest in a different release. */
export async function mapDigestAssetToRelease(
  digestAsset: DigestAsset,
  release: GithubRelease
): Promise<string | null> {
  const current = digestAsset.currentVersion.replace(regEx(/^v/), '');
  const next = release.tag_name.replace(regEx(/^v/), '');
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
      const [lineDigest, lineFn] = line.split(regEx(/\s+/), 2);
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
