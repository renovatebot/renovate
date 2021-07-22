export type GithubRelease = {
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  assets: GithubReleaseAsset[];
};

export type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};
