import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import type {
  GithubDigestFile,
  GithubRestAsset,
  GithubRestRelease,
} from '../../../util/github/types.ts';
import { getApiBaseUrl } from '../../../util/github/url.ts';
import { hashStream } from '../../../util/hash.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../github-releases/index.ts';
import type { DigestConfig } from '../types.ts';

/**
 * Any asset this small is worth reading as a possible checksum manifest,
 * whatever it is called.
 */
const smallAssetLimit = 5 * 1024;

/**
 * An asset whose name says it is a checksum manifest is read up to this size.
 * A release with many assets, such as a Godot release with 34, has a
 * `SHA512-SUMS.txt` that is larger than `smallAssetLimit`, and without this
 * every asset would be downloaded and hashed instead.
 */
const checksumManifestLimit = 64 * 1024;

/**
 * The names a checksum manifest goes by: `SHASUMS`, `SHA256SUMS`,
 * `SHA512-SUMS`, `SHASUMS512`, `checksums`, `sums`, and per-asset forms such
 * as `<asset>.sha384`, each optionally suffixed with `.txt`.
 */
const checksumManifestName = regEx(
  /(?:^|[^a-z0-9])(?:sha(?:256|384|512)?[-_]?sums?(?:256|384|512)?|sha(?:256|384|512)|checksums?|sums?)(?:\.txt)?$/i,
);

export function isChecksumManifestCandidate(asset: GithubRestAsset): boolean {
  if (asset.size < smallAssetLimit) {
    return true;
  }
  return (
    asset.size < checksumManifestLimit && checksumManifestName.test(asset.name)
  );
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

export class GithubReleaseAttachmentsDatasource extends GithubReleasesDatasource {
  static override readonly id = 'github-release-attachments';

  constructor() {
    super(GithubReleaseAttachmentsDatasource.id);
  }

  private async _findDigestFile(
    release: GithubRestRelease,
    digest: string,
  ): Promise<GithubDigestFile | null> {
    const candidates = release.assets.filter(isChecksumManifestCandidate);
    for (const asset of candidates) {
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
        key: `findDigestFile:${release.html_url}:${digest}`,
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
        key: `downloadAndDigest:${asset.browser_download_url}:${algorithm}`,
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
    const digestFile = await this.findDigestFile(release, digest);
    if (digestFile) {
      return digestFile;
    }

    const asset = await this.findAssetWithDigest(release, digest);
    return asset;
  }

  /** Given a digest asset, find the equivalent digest in a different release. */
  async mapDigestAssetToRelease(
    digestAsset: GithubDigestFile,
    release: GithubRestRelease,
  ): Promise<string | null> {
    const current = digestAsset.currentVersion.replace(regEx(/^v/), '');
    const next = release.tag_name.replace(regEx(/^v/), '');

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
    const newDigest = await this.downloadAndDigest(asset, algorithm);
    return newDigest;
  }

  /**
   * Attempts to resolve the digest for the specified package.
   *
   * The `newValue` supplied here should be a valid tag for the GitHub release.
   * Requires `currentValue` and `currentDigest`.
   *
   * There may be many assets attached to the release. This function will:
   *  - Identify the asset pinned by `currentDigest` in the `currentValue` release
   *     - Download small release assets and checksum manifests (e.g. SHASUMS.txt) up to 64 KiB, and parse them.
   *     - Download individual assets until `currentDigest` is encountered. This is limited to sha256 and sha512.
   *  - Map the hashed asset to `newValue` and return the updated digest as a string
   */
  override async getDigest(
    {
      packageName: repo,
      currentValue,
      currentDigest,
      registryUrl,
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
        `${apiBaseUrl}repos/${repo}/releases/tags/${currentValue}`,
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
          `${apiBaseUrl}repos/${repo}/releases/tags/${newValue}`,
        );
      newDigest = await this.mapDigestAssetToRelease(digestAsset, newRelease);
    }
    return newDigest;
  }
}
