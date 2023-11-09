import * as httpMock from '../../../../../test/http-mock';
import { partial } from '../../../../../test/util';
import type { GithubRestRelease } from '../../../../util/github/types';

export class GitHubReleaseAttachmentMocker {
  constructor(
    private readonly githubApiHost: string,
    private readonly packageName: string,
  ) {}

  release(version: string): GithubRestRelease {
    return this.withAssets(version, {});
  }

  withAssets(
    version: string,
    assets: { [key: string]: string },
  ): GithubRestRelease {
    const releaseData = partial<GithubRestRelease>({
      tag_name: version,
      published_at: '2020-03-09T11:00:00Z',
      prerelease: false,
      assets: [],
    });
    for (const assetFn of Object.keys(assets)) {
      const assetPath = `/repos/${this.packageName}/releases/download/${version}/${assetFn}`;
      const urlPath = `/repos/${this.packageName}/releases/assets/${version}-${assetFn}`;
      const assetData = assets[assetFn];
      releaseData.assets.push({
        name: assetFn,
        size: assetData.length,
        url: `${this.githubApiHost}${urlPath}`,
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
      .get(`/repos/${this.packageName}/releases/tags/${version}`)
      .optionally()
      .reply(200, releaseData);
    return releaseData;
  }

  withDigestFileAsset(
    version: string,
    ...digests: string[]
  ): GithubRestRelease {
    return this.withAssets(version, { 'SHASUMS.txt': digests.join('\n') });
  }
}
