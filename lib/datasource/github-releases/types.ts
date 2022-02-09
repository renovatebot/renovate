export type GithubRelease = {
  id: number;
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  draft?: boolean;
  assets: GithubReleaseAsset[];

  html_url: string;
  name: string;
  body: string;
};

export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface DigestAsset {
  assetName: string;
  currentVersion: string;
  currentDigest: string;
  digestedFileName?: string;
}
