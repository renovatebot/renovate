import hasha from 'hasha';
import * as httpMock from '../../../../test/http-mock';
import type { GithubDigestFile } from '../../../util/github/types';
import { GitHubReleaseMocker } from './test';

import { GithubReleasesDatasource } from '.';

describe('modules/datasource/github-releases/digest', () => {
  const packageName = 'some/dep';
  const releaseMock = new GitHubReleaseMocker(
    'https://api.github.com',
    packageName
  );
  const githubReleases = new GithubReleasesDatasource();

  describe('findDigestAsset', () => {
    it('finds SHASUMS.txt file containing digest', async () => {
      const release = releaseMock.withDigestFileAsset(
        'v1.0.0',
        'test-digest    linux-amd64.tar.gz',
        'another-digest linux-arm64.tar.gz'
      );

      const digestAsset = await githubReleases.findDigestAsset(
        release,
        'test-digest'
      );
      expect(digestAsset?.assetName).toBe('SHASUMS.txt');
      expect(digestAsset?.digestedFileName).toBe('linux-amd64.tar.gz');
    });

    it('returns null when not found in digest file asset', async () => {
      const release = releaseMock.withDigestFileAsset(
        'v1.0.0',
        'another-digest linux-arm64.tar.gz'
      );
      // Small assets like this digest file may be downloaded twice
      httpMock
        .scope('https://api.github.com')
        .get(`/repos/${packageName}/releases/download/v1.0.0/SHASUMS.txt`)
        .reply(200, '');

      const digestAsset = await githubReleases.findDigestAsset(
        release,
        'test-digest'
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
      const contentDigest = await hasha.async(content, { algorithm: 'sha256' });

      const digestAsset = await githubReleases.findDigestAsset(
        release,
        contentDigest
      );
      expect(digestAsset?.assetName).toBe('asset.zip');
      expect(digestAsset?.digestedFileName).toBeUndefined();
    });

    it('returns null when no assets available', async () => {
      const release = releaseMock.release('v1.0.0');
      const digestAsset = await githubReleases.findDigestAsset(
        release,
        'test-digest'
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
          'updated-digest  asset.zip'
        );
        const digest = await githubReleases.mapDigestAssetToRelease(
          digestAsset,
          release
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
          'updated-digest  asset-1.0.1.zip'
        );
        const digest = await githubReleases.mapDigestAssetToRelease(
          digestAssetWithVersion,
          release
        );
        expect(digest).toBe('updated-digest');
      });

      it('returns null when not found in digest file', async () => {
        const release = releaseMock.withDigestFileAsset(
          'v1.0.1',
          'moot-digest asset.tar.gz'
        );
        const digest = await githubReleases.mapDigestAssetToRelease(
          digestAsset,
          release
        );
        expect(digest).toBeNull();
      });

      it('returns null when digest file not found', async () => {
        const release = releaseMock.release('v1.0.1');
        const digest = await githubReleases.mapDigestAssetToRelease(
          digestAsset,
          release
        );
        expect(digest).toBeNull();
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
        const contentDigest = await hasha.async(updatedContent, {
          algorithm: 'sha256',
        });

        const digest = await githubReleases.mapDigestAssetToRelease(
          digestAsset,
          release
        );
        expect(digest).toEqual(contentDigest);
      });

      it('returns null when not found', async () => {
        const release = releaseMock.release('v1.0.1');
        const digest = await githubReleases.mapDigestAssetToRelease(
          digestAsset,
          release
        );
        expect(digest).toBeNull();
      });
    });
  });
});
