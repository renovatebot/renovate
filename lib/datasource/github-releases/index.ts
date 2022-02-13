import hasha from 'hasha';
import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { GithubHttp } from '../../util/http/github';
import { newlineRegex, regEx } from '../../util/regex';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { getApiBaseUrl, getSourceUrl } from './common';
import type { DigestAsset, GithubRelease, GithubReleaseAsset } from './types';

export const cacheNamespace = 'datasource-github-releases';

function inferHashAlg(digest: string): string {
  switch (digest.length) {
    case 64:
      return 'sha256';
    default:
    case 96:
      return 'sha512';
  }
}

export class GithubReleasesDatasource extends Datasource {
  static id = 'github-releases';

  override readonly defaultRegistryUrls = ['https://github.com'];

  override http: GithubHttp;

  constructor(id = GithubReleasesDatasource.id) {
    super(id);
    this.http = new GithubHttp(id);
  }

  async findDigestFile(
    release: GithubRelease,
    digest: string
  ): Promise<DigestAsset | null> {
    const smallAssets = release.assets.filter(
      (a: GithubReleaseAsset) => a.size < 5 * 1024
    );
    for (const asset of smallAssets) {
      const res = await this.http.get(asset.browser_download_url);
      for (const line of res.body.split(newlineRegex)) {
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

  @cache({
    ttlMinutes: 1440,
    namespace: 'datasource-github-releases',
    key: (asset: GithubReleaseAsset, algorithm: string) =>
      `${asset.browser_download_url}:${algorithm}:assetDigest`,
  })
  async downloadAndDigest(
    asset: GithubReleaseAsset,
    algorithm: string
  ): Promise<string> {
    const res = this.http.stream(asset.browser_download_url);
    const digest = await hasha.fromStream(res, { algorithm });
    return digest;
  }

  async findAssetWithDigest(
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
    release: GithubRelease,
    digest: string
  ): Promise<DigestAsset> {
    const digestFile = await this.findDigestFile(release, digest);
    if (digestFile) {
      return digestFile;
    }

    const asset = await this.findAssetWithDigest(release, digest);
    return asset;
  }

  /** Given a digest asset, find the equivalent digest in a different release. */
  async mapDigestAssetToRelease(
    digestAsset: DigestAsset,
    release: GithubRelease
  ): Promise<string | null> {
    const current = digestAsset.currentVersion.replace(regEx(/^v/), '');
    const next = release.tag_name.replace(regEx(/^v/), '');
    const releaseChecksumAssetName = digestAsset.assetName.replace(
      current,
      next
    );
    const releaseAsset = release.assets.find(
      (a: GithubReleaseAsset) => a.name === releaseChecksumAssetName
    );
    if (!releaseAsset) {
      return null;
    }
    if (digestAsset.digestedFileName) {
      const releaseFilename = digestAsset.digestedFileName.replace(
        current,
        next
      );
      const res = await this.http.get(releaseAsset.browser_download_url);
      for (const line of res.body.split(newlineRegex)) {
        const [lineDigest, lineFn] = line.split(regEx(/\s+/), 2);
        if (lineFn === releaseFilename) {
          return lineDigest;
        }
      }
    } else {
      const algorithm = inferHashAlg(digestAsset.currentDigest);
      const newDigest = await this.downloadAndDigest(releaseAsset, algorithm);
      return newDigest;
    }
    return null;
  }

  @cache({
    ttlMinutes: 1440,
    namespace: 'datasource-github-releases',
    key: (
      {
        lookupName: repo,
        currentValue,
        currentDigest,
        registryUrl,
      }: DigestConfig,
      newValue?: string
    ) =>
      `${registryUrl}:${repo}:${currentValue}:${currentDigest}:${newValue}:digest`,
  })
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
  override async getDigest(
    {
      lookupName: repo,
      currentValue,
      currentDigest,
      registryUrl,
    }: DigestConfig,
    newValue: string
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

    const apiBaseUrl = getApiBaseUrl(registryUrl);
    const { body: currentRelease } = await this.http.getJson<GithubRelease>(
      `${apiBaseUrl}repos/${repo}/releases/tags/${currentValue}`
    );
    const digestAsset = await this.findDigestAsset(
      currentRelease,
      currentDigest
    );
    let newDigest: string;
    if (!digestAsset || newValue === currentValue) {
      newDigest = currentDigest;
    } else {
      const { body: newRelease } = await this.http.getJson<GithubRelease>(
        `${apiBaseUrl}repos/${repo}/releases/tags/${newValue}`
      );
      newDigest = await this.mapDigestAssetToRelease(digestAsset, newRelease);
    }
    return newDigest;
  }

  @cache({
    namespace: 'datasource-github-releases',
    key: ({ lookupName: repo, registryUrl }: GetReleasesConfig) =>
      `${registryUrl}:${repo}:tags`,
  })
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
  async getReleases({
    lookupName: repo,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    const url = `${apiBaseUrl}repos/${repo}/releases?per_page=100`;
    const res = await this.http.getJson<GithubRelease[]>(url, {
      paginate: true,
    });
    const githubReleases = res.body;
    const dependency: ReleaseResult = {
      sourceUrl: getSourceUrl(repo, registryUrl),
      releases: githubReleases
        .filter(({ draft }) => draft !== true)
        .map(({ tag_name, published_at, prerelease }) => ({
          version: tag_name,
          gitRef: tag_name,
          releaseTimestamp: published_at,
          isStable: prerelease ? false : undefined,
        })),
    };
    return dependency;
  }
}
