import { logger } from '../../../logger/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import type {
  GithubDigestFile,
  GithubRestAsset,
  GithubRestRelease,
} from '../../../util/github/types.ts';
import { getApiBaseUrl } from '../../../util/github/url.ts';
import { hashStream } from '../../../util/hash.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { stripVersionPrefix } from '../../../util/string.ts';
import { GithubReleasesDatasource } from '../github-releases/index.ts';
import type { DigestConfig } from '../types.ts';

function inferHashAlg(digest: string): string {
  switch (digest.length) {
    case 64:
      return 'sha256';
    default:
    case 96:
      return 'sha512';
  }
}

/** Returns the SHA-256 that GitHub recorded for the asset, if any. */
function getRecordedSha256(asset: GithubRestAsset): string | undefined {
  const prefix = 'sha256:';
  return asset.digest?.startsWith(prefix)
    ? asset.digest.slice(prefix.length)
    : undefined;
}

export class GithubReleaseAttachmentsDatasource extends GithubReleasesDatasource {
  static override readonly id = 'github-release-attachments';

  constructor() {
    super(GithubReleaseAttachmentsDatasource.id);
  }

  private async _findDigestFile(
    release: GithubRestRelease,
    digest: string,
  ): Promise<GithubDigestFile | null> {
    const smallAssets = release.assets.filter(
      (a: GithubRestAsset) => a.size < 5 * 1024,
    );
    for (const asset of smallAssets) {
      const res = await this.http.getText(asset.browser_download_url);
      for (const line of res.body.split(newlineRegex)) {
        const [lineDigest, lineFilename] = line.split(regEx(/\s+/), 2);
        if (lineDigest === digest) {
          return {
            assetName: asset.name,
            digestedFileName: lineFilename,
            currentVersion: release.tag_name,
            currentDigest: lineDigest,
          };
        }
      }
    }
    return null;
  }

  findDigestFile(
    release: GithubRestRelease,
    digest: string,
  ): Promise<GithubDigestFile | null> {
    return withCache(
      {
        ttlMinutes: 1440,
        namespace: `datasource-${GithubReleaseAttachmentsDatasource.id}`,
        key: buildCacheKey('findDigestFile', release.html_url, digest),
      },
      () => this._findDigestFile(release, digest),
    );
  }

  private async _downloadAndDigest(
    asset: GithubRestAsset,
    algorithm: string,
  ): Promise<string> {
    const res = this.http.stream(asset.browser_download_url);
    const digest = await hashStream(res, algorithm);
    return digest;
  }

  downloadAndDigest(
    asset: GithubRestAsset,
    algorithm: string,
  ): Promise<string> {
    return withCache(
      {
        ttlMinutes: 1440,
        namespace: `datasource-${GithubReleaseAttachmentsDatasource.id}`,
        key: buildCacheKey(
          'downloadAndDigest',
          asset.browser_download_url,
          algorithm,
        ),
      },
      () => this._downloadAndDigest(asset, algorithm),
    );
  }

  async findAssetWithDigest(
    release: GithubRestRelease,
    digest: string,
  ): Promise<GithubDigestFile | null> {
    const algorithm = inferHashAlg(digest);
    const assetsBySize = release.assets.sort(
      (a: GithubRestAsset, b: GithubRestAsset) => {
        if (a.size < b.size) {
          return -1;
        }
        if (a.size > b.size) {
          return 1;
        }
        return 0;
      },
    );

    for (const asset of assetsBySize) {
      const assetDigest = await this.downloadAndDigest(asset, algorithm);
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
  async findDigestAsset(
    release: GithubRestRelease,
    digest: string,
  ): Promise<GithubDigestFile | null> {
    const recordedAsset = release.assets.find(
      (a) => getRecordedSha256(a) === digest,
    );
    if (recordedAsset) {
      return {
        assetName: recordedAsset.name,
        currentVersion: release.tag_name,
        currentDigest: digest,
      };
    }

    const digestFile = await this.findDigestFile(release, digest);
    if (digestFile) {
      return digestFile;
    }

    const asset = await this.findAssetWithDigest(release, digest);
    return asset;
  }

  /**
   * Given a digest asset, find the equivalent digest in a different release.
   * Asset names are mapped by replacing `currentVersion` with `newVersion`, which default to the release tags.
   */
  async mapDigestAssetToRelease(
    digestAsset: GithubDigestFile,
    release: GithubRestRelease,
    currentVersion = digestAsset.currentVersion,
    newVersion = release.tag_name,
  ): Promise<string | null> {
    const current = stripVersionPrefix(currentVersion);
    const next = stripVersionPrefix(newVersion);

    if (digestAsset.digestedFileName) {
      const checksumAssetName = digestAsset.assetName.replace(current, next);
      const checksumAsset = release.assets.find(
        (a: GithubRestAsset) => a.name === checksumAssetName,
      );

      // If the checksum asset is not found in the new release, fall back to the download method
      if (checksumAsset) {
        const releaseFilename = digestAsset.digestedFileName.replace(
          current,
          next,
        );
        const res = await this.http.getText(checksumAsset.browser_download_url);
        for (const line of res.body.split(newlineRegex)) {
          const [lineDigest, lineFn] = line.split(regEx(/\s+/), 2);
          if (lineFn === releaseFilename) {
            return lineDigest;
          }
        }
        return null;
      }
    }

    const oldFileName = digestAsset.digestedFileName ?? digestAsset.assetName;
    const fileName = oldFileName.replace(current, next);

    const asset = release.assets.find(
      (a: GithubRestAsset) => a.name === fileName,
    );

    if (!asset) {
      return null;
    }

    const algorithm = inferHashAlg(digestAsset.currentDigest);
    const recordedDigest = getRecordedSha256(asset);
    if (algorithm === 'sha256' && recordedDigest) {
      return recordedDigest;
    }
    const newDigest = await this.downloadAndDigest(asset, algorithm);
    return newDigest;
  }

  /**
   * Attempts to resolve the digest for the specified package.
   *
   * Releases are fetched by their tags, `currentGitRef` and `newGitRef`, falling back to `currentValue` and `newValue`.
   * Asset names are mapped with `currentValue` and `newValue`, which may be versions that `extractVersion` took from the tags.
   * Requires `currentValue` and `currentDigest`.
   *
   * There may be many assets attached to the release. This function will:
   *  - Identify the asset pinned by `currentDigest` in the `currentValue` release
   *     - Match the SHA-256 that GitHub records for each asset.
   *     - Download small release assets, parse as checksum manifests (e.g. `SHASUMS.txt`).
   *     - Download individual assets until `currentDigest` is encountered. This is limited to sha256 and sha512.
   *  - Map the hashed asset to `newValue` and return the updated digest as a string, preferring the SHA-256 GitHub recorded
   */
  override async getDigest(
    {
      packageName: repo,
      currentValue,
      currentDigest,
      registryUrl,
      currentGitRef,
      newGitRef,
    }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    logger.debug(
      { repo, currentValue, currentDigest, registryUrl, newValue },
      'getDigest',
    );
    if (!currentDigest) {
      return null;
    }
    if (!currentValue) {
      return currentDigest;
    }
    if (!newValue) {
      return null;
    }

    const apiBaseUrl = getApiBaseUrl(registryUrl);
    const { body: currentRelease } =
      await this.http.getJsonUnchecked<GithubRestRelease>(
        `${apiBaseUrl}repos/${repo}/releases/tags/${currentGitRef ?? currentValue}`,
      );
    const digestAsset = await this.findDigestAsset(
      currentRelease,
      currentDigest,
    );
    let newDigest: string | null;
    if (!digestAsset || newValue === currentValue) {
      newDigest = currentDigest;
    } else {
      const { body: newRelease } =
        await this.http.getJsonUnchecked<GithubRestRelease>(
          `${apiBaseUrl}repos/${repo}/releases/tags/${newGitRef ?? newValue}`,
        );
      newDigest = await this.mapDigestAssetToRelease(
        digestAsset,
        newRelease,
        currentValue,
        newValue,
      );
    }
    return newDigest;
  }
}
