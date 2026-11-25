/**
 * REST responses
 */
export interface GithubRestRelease {
  id: number;
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  draft?: boolean;
  assets: GithubRestAsset[];

  html_url: string;
  name: string;
  body: string;
}

export interface GithubRestAsset {
  name: string;
  url: string;
  browser_download_url: string;
  size: number;
}

/**
 * Release asset
 */
export interface GithubDigestFile {
  assetName: string;
  currentVersion: string;
  currentDigest: string;
  digestedFileName?: string;
}

/**
 * The structures being stored with long-term caching
 */
export interface GithubCachedItem {
  version: string;
  releaseTimestamp: string;
}
