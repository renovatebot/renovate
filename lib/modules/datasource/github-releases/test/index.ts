import * as httpMock from '../../../../../test/http-mock';
import type { GithubRelease } from '../types';

export class GitHubReleaseMocker {
  constructor(
    private readonly githubApiHost: string,
    private readonly lookupName: string
  ) {}

  release(version: string): GithubRelease {
    return this.withAssets(version, {});
  }

  withAssets(
    version: string,
    assets: { [key: string]: string }
  ): GithubRelease {
    const releaseData = {
      tag_name: version,
      published_at: '2020-03-09T11:00:00Z',
      prerelease: false,
      assets: [],
    } as GithubRelease;
    for (const assetFn of Object.keys(assets)) {
      const assetPath = `/repos/${this.lookupName}/releases/download/${version}/${assetFn}`;
      const assetData = assets[assetFn];
      releaseData.assets.push({
        name: assetFn,
        size: assetData.length,
        browser_download_url: `${this.githubApiHost}${assetPath}`,
      });
      httpMock
        .scope(this.githubApiHost)
        .get(assetPath)
        .once()
        .reply(200, assetData);
    }
    httpMock
      .scope(this.githubApiHost)
      .get(`/repos/${this.lookupName}/releases/tags/${version}`)
      .optionally()
      .reply(200, releaseData);
    return releaseData;
  }

  withDigestFileAsset(version: string, ...digests: string[]): GithubRelease {
    return this.withAssets(version, { 'SHASUMS.txt': digests.join('\n') });
  }
}
