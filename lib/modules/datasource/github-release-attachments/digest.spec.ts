import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import type {
  GithubDigestFile,
  GithubRestAsset,
} from '../../../util/github/types.ts';
import { toSha256 } from '../../../util/hash.ts';
import {
  GithubReleaseAttachmentsDatasource,
  isChecksumManifestCandidate,
} from './index.ts';
import { GitHubReleaseAttachmentMocker } from './test/index.ts';

describe('modules/datasource/github-release-attachments/digest', () => {
  const packageName = 'some/dep';
  const releaseMock = new GitHubReleaseAttachmentMocker(
    'https://api.github.com',
    packageName,
  );
  const githubReleaseAttachments = new GithubReleaseAttachmentsDatasource();

  describe('isChecksumManifestCandidate', () => {
    it.each`
      name                                           | size         | expected
      ${'anything.zip'}                              | ${4 * 1024}  | ${true}
      ${'anything.zip'}                              | ${6 * 1024}  | ${false}
      ${'SHASUMS.txt'}                               | ${6 * 1024}  | ${true}
      ${'SHA512-SUMS.txt'}                           | ${6 * 1024}  | ${true}
      ${'SHASUMS256.txt'}                            | ${6 * 1024}  | ${true}
      ${'SHA256SUMS'}                                | ${6 * 1024}  | ${true}
      ${'actionlint_1.7.12_checksums.txt'}           | ${6 * 1024}  | ${true}
      ${'sha256.sum'}                                | ${6 * 1024}  | ${true}
      ${'uv-x86_64-unknown-linux-gnu.tar.gz.sha256'} | ${6 * 1024}  | ${true}
      ${'release.tar.gz.sha512'}                     | ${6 * 1024}  | ${true}
      ${'checksums.txt.asc'}                         | ${6 * 1024}  | ${false}
      ${'SHASUMS.txt'}                               | ${65 * 1024} | ${false}
    `('$name at $size bytes is $expected', ({ name, size, expected }) => {
      expect(
        isChecksumManifestCandidate(partial<GithubRestAsset>({ name, size })),
      ).toBe(expected);
    });
  });

  describe('findDigestAsset', () => {
    it('reads a checksum manifest larger than a small asset by its name', async () => {
      const padding = `${'0'.repeat(64)} `;
      const lines = Array.from(
        { length: 80 },
        (_, i) => `${padding}other-asset-${i}.tar.gz`,
      );
      lines.push('test-digest    linux-amd64.tar.gz');
      const manifest = lines.join('\n');
      expect(manifest.length).toBeGreaterThan(5 * 1024);
      const release = releaseMock.withAssets('v1.0.0', {
        'SHA512-SUMS.txt': manifest,
      });

      const digestAsset = await githubReleaseAttachments.findDigestAsset(
        release,
        'test-digest',
      );
      expect(digestAsset?.assetName).toBe('SHA512-SUMS.txt');
      expect(digestAsset?.digestedFileName).toBe('linux-amd64.tar.gz');
    });

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
