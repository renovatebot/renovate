import cacache from 'cacache';
import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { PackageCacheFile } from './file';

describe('util/cache/package/impl/file', () => {
  let tmpDir: DirectoryResult;
  let cacheDir: string;
  let cacheFileName: string;
  let packageCache: PackageCacheFile;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });
    cacheDir = tmpDir.path;
    cacheFileName = upath.join(cacheDir, '/renovate/renovate-cache-v1');
    packageCache = PackageCacheFile.create(cacheDir);
  });

  afterEach(async () => {
    await cacache.rm.all(cacheFileName);
    await tmpDir.cleanup();
  });

  it('sets and gets', async () => {
    await packageCache.set('_test-namespace', 'key', 1234, 5);
    const res = await packageCache.get('_test-namespace', 'key');
    expect(res).toBe(1234);
  });

  describe('get', () => {
    it('returns undefined on cache miss', async () => {
      const res = await packageCache.get('_test-namespace', 'missing-key');
      expect(res).toBeUndefined();
    });

    it('expires cached entries', async () => {
      await packageCache.set('_test-namespace', 'key', 1234, -5);
      const res = await packageCache.get('_test-namespace', 'key');
      expect(res).toBeUndefined();

      await expect(
        cacache.get(cacheFileName, '_test-namespace-key'),
      ).rejects.toThrow('No cache entry');
    });

    it('returns undefined for null cached value', async () => {
      await cacache.put(cacheFileName, '_test-namespace-key', 'null');
      const res = await packageCache.get('_test-namespace', 'key');
      expect(res).toBeUndefined();
    });

    it('returns undefined for invalid JSON', async () => {
      await cacache.put(cacheFileName, '_test-namespace-key', 'invalid-json');
      const res = await packageCache.get('_test-namespace', 'key');
      expect(res).toBeUndefined();
    });

    it('returns undefined for corrupted compressed value', async () => {
      await cacache.put(
        cacheFileName,
        '_test-namespace-key',
        JSON.stringify({
          compress: true,
          value: 'not-base64-encoded-gzip',
          expiry: DateTime.local().plus({ minutes: 5 }),
        }),
      );
      const res = await packageCache.get('_test-namespace', 'key');
      expect(res).toBeUndefined();
    });

    it('retrieves non-compressed value', async () => {
      await cacache.put(
        cacheFileName,
        '_test-namespace-key',
        JSON.stringify({
          compress: false,
          value: 1234,
          expiry: DateTime.local().plus({ minutes: 5 }),
        }),
      );
      const res = await packageCache.get('_test-namespace', 'key');
      expect(res).toBe(1234);
    });
  });

  describe('destroy', () => {
    it('removes expired and invalid entries', async () => {
      await packageCache.set('_test-namespace', 'valid', 1234, 5);
      await packageCache.set('_test-namespace', 'expired', 1234, -5);
      await cacache.put(cacheFileName, 'invalid', 'not json');

      const cacheObject = await cacache.get(
        cacheFileName,
        '_test-namespace-expired',
      );
      const expiredDigest = cacheObject.integrity;

      await packageCache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).toEqual(['_test-namespace-valid']);

      await expect(
        cacache.get.byDigest(cacheFileName, expiredDigest),
      ).rejects.toThrow('ENOENT');
    });

    it('continues on cleanup errors', async () => {
      await packageCache.set('_test-namespace', 'valid', 1234, 5);
      const cacacheGet = vi
        .spyOn(cacache, 'get')
        .mockRejectedValue(new Error('error'));

      await packageCache.destroy();

      expect(cacacheGet).toHaveBeenCalled();
    });
  });
});
