import hasha from 'hasha';
import { getName } from '../../../test/util';
import { GitHubReleaseMocker } from './__testutil__';
import { findDigestAsset } from './digest';

describe(getName(), () => {
  const lookupName = 'some/dep';
  const releaseMock = new GitHubReleaseMocker(
    'https://api.github.com',
    lookupName
  );

  describe('findDigestAsset', () => {
    it('finds SHASUMS.txt file containing digest', async () => {
      const release = releaseMock.withDigestFileAsset(
        'v1.0.0',
        'test-digest    linux-amd64.tar.gz',
        'another-digest linux-arm64.tar.gz'
      );

      const digestAsset = await findDigestAsset(release, 'test-digest');
      expect(digestAsset.assetName).toBe('SHASUMS.txt');
      expect(digestAsset.digestedFileName).toBe('linux-amd64.tar.gz');
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

      const digestAsset = await findDigestAsset(release, contentDigest);
      expect(digestAsset.assetName).toBe('asset.zip');
      expect(digestAsset.digestedFileName).toBeUndefined();
    });

    it('returns null when not found', async () => {
      const release = releaseMock.release('v1.0.0');
      const digestAsset = await findDigestAsset(release, 'test-digest');
      expect(digestAsset).toBeNull();
    });
  });
});
