export type GithubRelease = {
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  assets: GithubReleaseAsset[];
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
