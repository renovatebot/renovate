import { dir } from 'tmp-promise';
import { GlobalConfig } from '../../../config/global.ts';
import { outputCacheFile } from '../../../util/fs/index.ts';
import { computeFileChecksum } from './checksum.ts';

describe('modules/datasource/deb/checksum', () => {
  beforeEach(async () => {
    const cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });
  });

  describe('computeFileChecksum', () => {
    it('computes the checksum of a file', async () => {
      await outputCacheFile('file.txt', 'bar');

      const expectedHash =
        'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9';

      expect(await computeFileChecksum('file.txt')).toBe(expectedHash);
    });

    it('should fail if there is an error in the stream', async () => {
      await expect(computeFileChecksum('file.txt')).rejects.toThrow();
    });
  });
});
