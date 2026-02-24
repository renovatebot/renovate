import cacache from 'cacache';
import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { PackageCacheFile } from './file.ts';

describe('util/cache/package/impl/file', () => {
  let tmpDir: DirectoryResult;
  let cacheDir: string;
  let cacheFileName: string;
  let cache: PackageCacheFile;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });
    cacheDir = tmpDir.path;
    cacheFileName = upath.join(cacheDir, '/renovate/renovate-cache-v1');
    cache = PackageCacheFile.create(cacheDir);
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  describe('basic operations', () => {
    it('sets and gets', async () => {
      await cache.set('_test-namespace', 'key', 1234, 5);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
    });
  });

  describe('get', () => {
    it('returns undefined on cache miss', async () => {
      const res = await cache.get('_test-namespace', 'missing-key');

      expect(res).toBeUndefined();
    });

    it('expires cached entries', async () => {
      await cache.set('_test-namespace', 'key', 1234, -5);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();

      await expect(
        cacache.get(cacheFileName, '_test-namespace-key'),
      ).rejects.toThrow('No cache entry');
    });

    it('returns undefined for null cached value', async () => {
      await cacache.put(cacheFileName, '_test-namespace-key', 'null');

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for invalid JSON', async () => {
      await cacache.put(cacheFileName, '_test-namespace-key', 'invalid-json');

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for corrupted compressed value', async () => {
      const payload = JSON.stringify({
        compress: true,
        value: 'not-base64-encoded-gzip',
        expiry: DateTime.local().plus({ minutes: 5 }),
      });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for missing expiry', async () => {
      const payload = JSON.stringify({ compress: false, value: 1234 });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for invalid expiry', async () => {
      const payload = JSON.stringify({
        compress: false,
        value: 1234,
        expiry: 'not-a-date',
      });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('retrieves non-compressed value', async () => {
      const payload = JSON.stringify({
        compress: false,
        value: 1234,
        expiry: DateTime.local().plus({ minutes: 5 }),
      });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
    });
  });

  describe('destroy', () => {
    it('removes expired and invalid entries', async () => {
      await cache.set('_test-namespace', 'valid', 1234, 5);
      await cache.set('_test-namespace', 'expired', 1234, -5);
      await cacache.put(cacheFileName, 'invalid', 'not json');

      const cacheObject = await cacache.get(
        cacheFileName,
        '_test-namespace-expired',
      );
      const expiredDigest = cacheObject.integrity;

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).toEqual(['_test-namespace-valid']);

      await expect(
        cacache.get.byDigest(cacheFileName, expiredDigest),
      ).rejects.toThrow('ENOENT');
    });

    it('keeps entries without expiry field', async () => {
      const payload = JSON.stringify({ value: 'no-expiry' });
      await cacache.put(cacheFileName, 'no-expiry-key', payload);

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).toContain('no-expiry-key');
    });

    it('removes entries with invalid expiry', async () => {
      const payload = JSON.stringify({
        value: 'bad-expiry',
        expiry: 'not-a-date',
      });
      await cacache.put(cacheFileName, 'bad-expiry-key', payload);

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).not.toContain('bad-expiry-key');
    });

    it('continues on cleanup errors', async () => {
      await cache.set('_test-namespace', 'valid', 1234, 5);
      const cacacheGet = vi
        .spyOn(cacache, 'get')
        .mockRejectedValue(new Error('error'));

      await cache.destroy();

      expect(cacacheGet).toHaveBeenCalled();
    });
  });
});
