import * as httpMock from '~test/http-mock.ts';
import type { GithubDigestFile } from '../../../util/github/types.ts';
import { hash, toSha256 } from '../../../util/hash.ts';
import { GithubReleaseAttachmentsDatasource } from './index.ts';
import { GitHubReleaseAttachmentMocker } from './test/index.ts';

describe('modules/datasource/github-release-attachments/digest', () => {
  const packageName = 'some/dep';
  const releaseMock = new GitHubReleaseAttachmentMocker(
    'https://api.github.com',
    packageName,
  );
  const githubReleaseAttachments = new GithubReleaseAttachmentsDatasource();

  describe('findDigestAsset', () => {
    it('finds SHASUMS.txt file containing digest', async () => {
      const release = releaseMock.withDigestFileAsset(
        'v1.0.0',
        'test-digest    linux-amd64.tar.gz',
        'another-digest linux-arm64.tar.gz',
      );

      const digestAsset = await githubReleaseAttachments.findDigestAsset(
        release,
        'test-digest',
      );
      expect(digestAsset?.assetName).toBe('SHASUMS.txt');
      expect(digestAsset?.digestedFileName).toBe('linux-amd64.tar.gz');
    });

    it('returns null when not found in digest file asset', async () => {
      const release = releaseMock.withDigestFileAsset(
        'v1.0.0',
        'another-digest linux-arm64.tar.gz',
      );
      // Small assets like this digest file may be downloaded twice
      httpMock
        .scope('https://api.github.com')
        .get(`/repos/${packageName}/releases/download/v1.0.0/SHASUMS.txt`)
        .reply(200, '');

      const digestAsset = await githubReleaseAttachments.findDigestAsset(
        release,
        'test-digest',
      );
      expect(digestAsset).toBeNull();
    });

    it('finds asset by digest', async () => {
      const content = '1'.repeat(10 * 1024);
      const release = releaseMock.withAssets('v1.0.0', {
        'smaller.zip': '1'.repeat(9 * 1024),
        'same-size.zip': '2'.repeat(10 * 1024),
        'asset.zip': content,
        'smallest.zip': '1'.repeat(8 * 1024),
      });
      const contentDigest = toSha256(content);

      const digestAsset = await githubReleaseAttachments.findDigestAsset(
        release,
        contentDigest,
      );
      expect(digestAsset?.assetName).toBe('asset.zip');
      expect(digestAsset?.digestedFileName).toBeUndefined();
    });

    it('finds asset by the digest GitHub recorded, without downloading it', async () => {
      const recordedDigest = 'a'.repeat(64);
      const release = releaseMock.release('v1.0.0');
      release.assets.push({
        name: 'asset.zip',
        size: 10 * 1024,
        url: 'https://api.github.com/repos/some/dep/releases/assets/1',
        browser_download_url:
          'https://github.com/some/dep/releases/download/v1.0.0/asset.zip',
        digest: `sha256:${recordedDigest}`,
      });

      const digestAsset = await githubReleaseAttachments.findDigestAsset(
        release,
        recordedDigest,
      );
      expect(digestAsset).toEqual({
        assetName: 'asset.zip',
        currentVersion: 'v1.0.0',
        currentDigest: recordedDigest,
      });
    });

    it('returns null when no assets available', async () => {
      const release = releaseMock.release('v1.0.0');
      const digestAsset = await githubReleaseAttachments.findDigestAsset(
        release,
        'test-digest',
      );
      expect(digestAsset).toBeNull();
    });
  });

  describe('mapDigestAssetToRelease', () => {
    describe('with digest file', () => {
      const digestAsset: GithubDigestFile = {
        assetName: 'SHASUMS.txt',
        currentVersion: 'v1.0.0',
        currentDigest: 'old-digest',
        digestedFileName: 'asset.zip',
      };

      it('downloads updated digest file', async () => {
        const release = releaseMock.withDigestFileAsset(
          'v1.0.1',
          'updated-digest  asset.zip',
        );
        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAsset,
          release,
        );
        expect(digest).toBe('updated-digest');
      });

      it('maps digested file name to new version', async () => {
        const digestAssetWithVersion = {
          ...digestAsset,
          digestedFileName: 'asset-1.0.0.zip',
        };

        const release = releaseMock.withDigestFileAsset(
          'v1.0.1',
          'updated-digest  asset-1.0.1.zip',
        );
        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAssetWithVersion,
          release,
        );
        expect(digest).toBe('updated-digest');
      });

      it('returns null when not found in digest file', async () => {
        const release = releaseMock.withDigestFileAsset(
          'v1.0.1',
          'moot-digest asset.tar.gz',
        );
        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAsset,
          release,
        );
        expect(digest).toBeNull();
      });

      it('returns null when digest file not found', async () => {
        const release = releaseMock.release('v1.0.1');
        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAsset,
          release,
        );
        expect(digest).toBeNull();
      });

      it('falls back to digesting file when checksum file is removed', async () => {
        const checksumAssetWithVersion: GithubDigestFile = {
          assetName: 'SHASUMS.txt',
          currentVersion: 'v1.0.0',
          currentDigest: '0'.repeat(64),
          digestedFileName: 'asset-v1.0.0.zip',
        };
        const updatedContent = 'new content';
        const release = releaseMock.withAssets('v1.0.1', {
          'asset-v1.0.1.zip': updatedContent,
        });
        const contentDigest = toSha256(updatedContent);

        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          checksumAssetWithVersion,
          release,
        );
        expect(digest).toEqual(contentDigest);
      });
    });

    describe('with digested file', () => {
      const digestAsset: GithubDigestFile = {
        assetName: 'asset.zip',
        currentVersion: 'v1.0.0',
        currentDigest: '0'.repeat(64),
      };

      it('digests updated file', async () => {
        const updatedContent = 'new content';
        const release = releaseMock.withAssets('v1.0.1', {
          'asset.zip': updatedContent,
        });
        const contentDigest = toSha256(updatedContent);

        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAsset,
          release,
        );
        expect(digest).toEqual(contentDigest);
      });

      it('maps asset names with the given versions', async () => {
        const updatedContent = 'new content';
        const release = releaseMock.withAssets('v.0.9.8.1', {
          'USBip-0.9.8.1-x64.exe': updatedContent,
        });

        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          {
            assetName: 'USBip-0.9.8.0-x64.exe',
            currentVersion: 'v.0.9.8.0',
            currentDigest: '0'.repeat(64),
          },
          release,
          '0.9.8.0',
          '0.9.8.1',
        );
        expect(digest).toEqual(toSha256(updatedContent));
      });

      it('uses the SHA-256 GitHub recorded, without downloading the asset', async () => {
        const recordedDigest = 'b'.repeat(64);
        const release = releaseMock.release('v1.0.1');
        release.assets.push({
          name: 'asset.zip',
          size: 10 * 1024,
          url: 'https://api.github.com/repos/some/dep/releases/assets/2',
          browser_download_url:
            'https://github.com/some/dep/releases/download/v1.0.1/asset.zip',
          digest: `sha256:${recordedDigest}`,
        });

        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAsset,
          release,
        );
        expect(digest).toBe(recordedDigest);
      });

      it('downloads the asset when a SHA-512 is pinned', async () => {
        const updatedContent = 'new content';
        const release = releaseMock.withAssets('v1.0.1', {
          'asset.zip': updatedContent,
        });
        release.assets[0].digest = `sha256:${toSha256(updatedContent)}`;

        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          { ...digestAsset, currentDigest: '0'.repeat(128) },
          release,
        );
        expect(digest).toBe(hash(updatedContent, 'sha512'));
      });

      it('returns null when not found', async () => {
        const release = releaseMock.release('v1.0.1');
        const digest = await githubReleaseAttachments.mapDigestAssetToRelease(
          digestAsset,
          release,
        );
        expect(digest).toBeNull();
      });
    });
  });
});
