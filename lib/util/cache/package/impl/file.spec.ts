import cacache from 'cacache';
import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import {
  compressToBase64,
  compressToBuffer,
  decompressFromBuffer,
} from '../../../compress.ts';
import { PackageCacheFile } from './file.ts';

declare module 'luxon' {
  interface TSSettings {
    throwOnInvalid: true;
  }
}

describe('util/cache/package/impl/file', () => {
  let tmpDir: DirectoryResult;
  let cacheDir: string;
  let cacheFileName: string;
  let cache: PackageCacheFile;
  const namespace = '_test-namespace';
  const cacheVersion = 2;
  const cacheKey = (key: string): string => `${namespace}-${key}`;

  const expectNoCacheEntry = async (key: string): Promise<void> => {
    await expect(cacache.get(cacheFileName, key)).rejects.toThrow(
      'No cache entry',
    );
  };

  function getExpiry(minutes: number): string {
    const expiry = DateTime.local().plus({ minutes }).toISO();
    if (!expiry) {
      throw new Error('Expected valid cache expiry');
    }
    return expiry;
  }

  async function getCacheKeys(): Promise<string[]> {
    const cacheEntries = await cacache.ls(cacheFileName);
    return Object.keys(cacheEntries);
  }

  async function putLegacyEntry(
    cacheEntryKey: string,
    value: unknown,
    ttlMinutes: number,
  ): Promise<{ expiry: string; payload: string }> {
    const expiry = getExpiry(ttlMinutes);
    const compressedValue = await compressToBase64(JSON.stringify(value));
    const payload = JSON.stringify({
      compress: true,
      value: compressedValue,
      expiry,
    });
    await cacache.put(cacheFileName, cacheEntryKey, payload);
    return { expiry, payload };
  }

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
      await cache.set(namespace, 'key', 1234, 5);

      const res = await cache.get(namespace, 'key');

      expect(res).toBe(1234);
    });
  });

  describe('set', () => {
    it('stores expiry in index metadata', async () => {
      await cache.set(namespace, 'key', 1234, 5);

      const info = await cacache.get.info(cacheFileName, cacheKey('key'));
      const cacheEntry = await cacache.get(cacheFileName, cacheKey('key'));
      const cachedValue = await decompressFromBuffer(cacheEntry.data);

      expect(info?.metadata).toEqual({
        expiry: expect.any(String),
        version: cacheVersion,
      });
      expect(cachedValue).toBe('1234');
    });

    it('throws for invalid computed expiry', async () => {
      const localSpy = vi
        .spyOn(DateTime, 'local')
        .mockReturnValue(DateTime.fromISO('invalid'));

      await expect(cache.set(namespace, 'key', 1234, 5)).rejects.toThrow(
        'Invalid package cache expiry',
      );

      localSpy.mockRestore();
    });
  });

  describe('get', () => {
    it('returns undefined on cache miss', async () => {
      const res = await cache.get(namespace, 'missing-key');

      expect(res).toBeUndefined();
    });

    it('expires cached entries', async () => {
      await cache.set(namespace, 'key', 1234, -5);

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();

      await expectNoCacheEntry(cacheKey('key'));
    });

    it('expires metadata-backed entries without blob reads', async () => {
      await cache.set(namespace, 'key', 1234, -5);
      const cacacheGet = vi.spyOn(cacache, 'get');

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
      expect(cacacheGet).not.toHaveBeenCalled();
    });

    it('returns undefined for null cached value', async () => {
      await cacache.put(cacheFileName, cacheKey('key'), 'null');

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for invalid JSON', async () => {
      await cacache.put(cacheFileName, cacheKey('key'), 'invalid-json');

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for corrupted compressed value', async () => {
      const payload = JSON.stringify({
        compress: true,
        value: 'not-base64-encoded-gzip',
        expiry: getExpiry(5),
      });
      await cacache.put(cacheFileName, cacheKey('key'), payload);

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for malformed decompressed cache data', async () => {
      const cacheEntryValue = await compressToBuffer('not-json');
      await cacache.put(cacheFileName, cacheKey('key'), cacheEntryValue, {
        metadata: {
          version: cacheVersion,
          expiry: getExpiry(5),
        },
      });

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for legacy entry with malformed decompressed payload', async () => {
      const compressedValue = await compressToBase64('not-json');
      const payload = JSON.stringify({
        compress: true,
        value: compressedValue,
        expiry: getExpiry(5),
      });
      await cacache.put(cacheFileName, cacheKey('key'), payload);

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for missing expiry', async () => {
      const compressedValue = await compressToBase64(JSON.stringify(1234));
      const payload = JSON.stringify({
        compress: true,
        value: compressedValue,
      });
      await cacache.put(cacheFileName, cacheKey('key'), payload);

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();

      await expectNoCacheEntry(cacheKey('key'));
    });

    it('returns undefined for invalid expiry', async () => {
      const compressedValue = await compressToBase64(JSON.stringify(1234));
      const payload = JSON.stringify({
        compress: true,
        value: compressedValue,
        expiry: 'not-a-date',
      });
      await cacache.put(cacheFileName, cacheKey('key'), payload);

      const res = await cache.get(namespace, 'key');

      expect(res).toBeUndefined();
    });

    it('retrieves legacy compressed values', async () => {
      await putLegacyEntry(cacheKey('key'), 1234, 5);

      const res = await cache.get(namespace, 'key');

      expect(res).toBe(1234);
    });
  });

  describe('destroy', () => {
    it('uses metadata to clean up new-format entries', async () => {
      await cache.set(namespace, 'valid', 1234, 5);
      await cache.set(namespace, 'expired', 1234, -5);

      const cacacheGet = vi.spyOn(cacache, 'get');

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).toEqual([cacheKey('valid')]);
      expect(cacacheGet).not.toHaveBeenCalled();
    });

    it('lazily migrates valid legacy entries without deleting them', async () => {
      const { expiry, payload } = await putLegacyEntry(
        'legacy-valid-key',
        1234,
        5,
      );

      await cache.destroy();

      const cacheKeys = await getCacheKeys();
      const validInfo = await cacache.get.info(
        cacheFileName,
        'legacy-valid-key',
      );
      const validEntry = await cacache.get(cacheFileName, 'legacy-valid-key');
      const validValue = await decompressFromBuffer(validEntry.data);

      expect(cacheKeys).toEqual(['legacy-valid-key']);
      expect(validInfo?.metadata).toEqual({
        expiry,
        version: cacheVersion,
      });
      expect(validValue).toBe('1234');
      expect(validEntry.data.toString()).not.toBe(payload);
    });

    it('uses migrated metadata for subsequent cleanup passes', async () => {
      await putLegacyEntry('legacy-valid-key', 1234, 5);

      const cacacheGet = vi.spyOn(cacache, 'get');

      await cache.destroy();
      cacacheGet.mockClear();

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).toEqual(['legacy-valid-key']);
      expect(cacacheGet).not.toHaveBeenCalled();
    });

    it('does not delete shared content used by surviving entries', async () => {
      await cache.set(namespace, 'expired-shared-key', 1234, -5);
      await cache.set(namespace, 'valid-shared-key', 1234, 5);

      await cache.destroy();

      const cacheKeys = await getCacheKeys();
      const validEntry = await cache.get(namespace, 'valid-shared-key');

      expect(cacheKeys).toEqual([cacheKey('valid-shared-key')]);
      expect(validEntry).toBe(1234);

      await expectNoCacheEntry(cacheKey('expired-shared-key'));
    });

    it('removes expired legacy and invalid entries', async () => {
      await cache.set(namespace, 'valid', 1234, 5);
      const { payload: expiredPayload } = await putLegacyEntry(
        cacheKey('expired'),
        1234,
        -5,
      );
      await cacache.put(cacheFileName, 'invalid', 'not json');

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).toEqual([cacheKey('valid')]);

      await expectNoCacheEntry(cacheKey('expired'));
      await expectNoCacheEntry('invalid');

      expect(expiredPayload).toContain('"compress":true');
    });

    it('removes invalid legacy entries without expiry', async () => {
      const compressedValue = await compressToBase64(
        JSON.stringify('no-expiry'),
      );
      const payload = JSON.stringify({
        compress: true,
        value: compressedValue,
      });
      await cacache.put(cacheFileName, 'no-expiry-key', payload);

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).not.toContain('no-expiry-key');
    });

    it('removes entries with invalid expiry', async () => {
      const compressedValue = await compressToBase64(
        JSON.stringify('bad-expiry'),
      );
      const payload = JSON.stringify({
        compress: true,
        value: compressedValue,
        expiry: 'not-a-date',
      });
      await cacache.put(cacheFileName, 'bad-expiry-key', payload);

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).not.toContain('bad-expiry-key');
    });

    it('removes entries with invalid metadata', async () => {
      await cacache.put(cacheFileName, 'invalid-metadata', '1234', {
        metadata: 'invalid' as unknown as { expiry: string; version: number },
      });

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).not.toContain('invalid-metadata');
    });

    it('removes entries with unsupported metadata version', async () => {
      const payload = await compressToBuffer('1234');
      await cacache.put(cacheFileName, 'unsupported-version', payload, {
        metadata: {
          version: 1,
          expiry: getExpiry(5),
        },
      });

      await cache.destroy();

      const cacheKeys = await getCacheKeys();

      expect(cacheKeys).not.toContain('unsupported-version');
    });

    it('continues on cleanup errors', async () => {
      await putLegacyEntry(cacheKey('valid'), 1234, 5);
      const cacacheGet = vi
        .spyOn(cacache, 'get')
        .mockRejectedValue(new Error('error'));

      await cache.destroy();

      expect(cacacheGet).toHaveBeenCalled();
    });
  });
});
