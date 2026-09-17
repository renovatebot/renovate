import cacache from 'cacache';
import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { logger as _logger } from '~test/util.ts';
import { compressToBase64, compressToBuffer } from '../../../compress.ts';
import { decodeEntry, encodeEntry, isEnvelope } from '../codec.ts';
import { PackageCacheFile } from './file.ts';

const { logger } = _logger;

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

    it('stores envelope payload with backend-native metadata expiry', async () => {
      await cache.set('_test-namespace', 'key', 1234, 5);

      const entry = await cacache.get(cacheFileName, '_test-namespace-key');
      const decoded = await decodeEntry(entry.data);

      expect(isEnvelope(entry.data)).toBeTrue();
      expect(decoded.value).toBe(1234);
      expect(entry.metadata.expiry).toBeNumber();
      expect(entry.metadata.expiry).toBeGreaterThan(Date.now());
    });
  });

  describe('set', () => {
    it('deletes entries for non-positive TTL', async () => {
      await cache.set('_test-namespace', 'key', 1234, -5);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();

      await expect(
        cacache.get(cacheFileName, '_test-namespace-key'),
      ).rejects.toThrow('No cache entry');
    });
  });

  describe('get', () => {
    it('returns undefined on cache miss', async () => {
      const res = await cache.get('_test-namespace', 'missing-key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for expired metadata without removing entry', async () => {
      await cacache.put(
        cacheFileName,
        '_test-namespace-key',
        await encodeEntry(1234, DateTime.local()),
        { metadata: { expiry: Date.now() - 1 } },
      );

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
      await expect(
        cacache.get(cacheFileName, '_test-namespace-key'),
      ).resolves.toBeDefined();
    });

    it('returns undefined and removes undecodable non-envelope payloads', async () => {
      await cacache.put(cacheFileName, '_test-namespace-key', 'not-brotli');

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
      expect(logger.once.debug).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error while reading package cache value',
      );
      await expect(
        cacache.get(cacheFileName, '_test-namespace-key'),
      ).rejects.toThrow('No cache entry');
    });

    // TODO: Replace legacy JSON-wrapper malformed-entry fixtures with
    // unsupported non-envelope fixtures once legacy.ts is removed.
    it('returns undefined for corrupted legacy JSON-wrapper payload', async () => {
      const payload = JSON.stringify({
        value: 'not-base64-encoded-gzip',
        expiry: DateTime.local().plus({ minutes: 5 }),
      });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for legacy JSON-wrapper payload with missing expiry', async () => {
      const value = await compressToBase64(JSON.stringify(1234));
      const payload = JSON.stringify({ value });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    it('returns undefined for legacy JSON-wrapper payload with invalid expiry', async () => {
      const value = await compressToBase64(JSON.stringify(1234));
      const payload = JSON.stringify({
        value,
        expiry: 'not-a-date',
      });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBeUndefined();
    });

    // TODO: Delete this legacy JSON-wrapper read case once legacy.ts is removed.
    it('retrieves value from legacy JSON-wrapper payload', async () => {
      const value = await compressToBase64(JSON.stringify(1234));
      const expiry = DateTime.local().plus({ minutes: 5 });
      const payload = JSON.stringify({ value, expiry });
      await cacache.put(cacheFileName, '_test-namespace-key', payload);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
    });

    it('retrieves value from envelope payload', async () => {
      await cacache.put(
        cacheFileName,
        '_test-namespace-key',
        await encodeEntry(1234, DateTime.local()),
      );

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
    });
  });

  // TODO: Delete this block once legacy.ts is removed.
  describe('legacy upgrade-on-read', () => {
    it('rewrites a valid legacy entry as an envelope with its expiry', async () => {
      const value = await compressToBase64(JSON.stringify(1234));
      const expiry = DateTime.local().plus({ minutes: 5 });
      await cacache.put(
        cacheFileName,
        '_test-namespace-key',
        JSON.stringify({ value, expiry }),
      );

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
      const entry = await cacache.get(cacheFileName, '_test-namespace-key');
      expect(isEnvelope(entry.data)).toBeTrue();
      expect((await decodeEntry(entry.data)).value).toBe(1234);
      expect(entry.metadata.expiry).toBe(expiry.toMillis());
    });

    it('returns the value when the upgrade write fails', async () => {
      const value = await compressToBase64(JSON.stringify(1234));
      const expiry = DateTime.local().plus({ minutes: 5 });
      await cacache.put(
        cacheFileName,
        '_test-namespace-key',
        JSON.stringify({ value, expiry }),
      );
      const cacachePut = vi
        .spyOn(cacache, 'put')
        .mockRejectedValueOnce(new Error('write failed'));

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
      expect(logger.once.debug).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error while upgrading legacy cache entry',
      );
      cacachePut.mockRestore();
    });

    it('does not upgrade a legacy entry without a derivable expiry', async () => {
      const data = await compressToBuffer(JSON.stringify(1234));
      await cacache.put(cacheFileName, '_test-namespace-key', data);

      const res = await cache.get('_test-namespace', 'key');

      expect(res).toBe(1234);
      const entry = await cacache.get(cacheFileName, '_test-namespace-key');
      expect(isEnvelope(entry.data)).toBeFalse();
    });
  });

  describe('destroy', () => {
    it('removes expired new-format, legacy, and garbage entries', async () => {
      await cache.set('_test-namespace', 'valid', 1234, 5);
      const expiredIntegrity = await cacache.put(
        cacheFileName,
        'expired',
        await encodeEntry('expired', DateTime.local()),
        { metadata: { expiry: Date.now() - 1 } },
      );
      // TODO: Drop this legacy JSON-wrapper fixture once legacy.ts is removed;
      // keep no-metadata foreign-entry sweep coverage separately.
      const legacyValue = await compressToBase64(JSON.stringify('legacy'));
      const legacyIntegrity = await cacache.put(
        cacheFileName,
        'legacy',
        JSON.stringify({
          value: legacyValue,
          expiry: DateTime.local().plus({ minutes: 5 }).toISO(),
        }),
      );
      const garbageIntegrity = await cacache.put(
        cacheFileName,
        'garbage',
        'not json',
      );

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).toEqual(['_test-namespace-valid']);

      await expect(
        cacache.get.byDigest(cacheFileName, expiredIntegrity),
      ).rejects.toThrow('ENOENT');
      await expect(
        cacache.get.byDigest(cacheFileName, legacyIntegrity),
      ).rejects.toThrow('ENOENT');
      await expect(
        cacache.get.byDigest(cacheFileName, garbageIntegrity),
      ).rejects.toThrow('ENOENT');
    });

    it('keeps entries with valid non-expired expiry metadata', async () => {
      await cacache.put(
        cacheFileName,
        'future-expiry-key',
        await encodeEntry('future', DateTime.local()),
        { metadata: { expiry: Date.now() + 60_000 } },
      );

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).toContain('future-expiry-key');
    });

    it('removes entries without expiry metadata', async () => {
      const payload = JSON.stringify({ value: 'no-expiry' });
      await cacache.put(cacheFileName, 'no-expiry-key', payload);

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).not.toContain('no-expiry-key');
    });

    it('removes entries with invalid expiry metadata', async () => {
      await cacache.put(
        cacheFileName,
        'bad-expiry-key',
        await encodeEntry('bad-expiry', DateTime.local()),
        { metadata: { expiry: 'not-a-date' } },
      );

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).not.toContain('bad-expiry-key');
    });

    it('continues on cleanup errors', async () => {
      await cacache.put(
        cacheFileName,
        'expired-error',
        await encodeEntry('expired-error', DateTime.local()),
        { metadata: { expiry: Date.now() - 1 } },
      );
      await cacache.put(
        cacheFileName,
        'expired-next',
        await encodeEntry('expired-next', DateTime.local()),
        { metadata: { expiry: Date.now() - 1 } },
      );
      const rmEntry = cacache.rm.entry;
      const cacacheRmEntry = vi
        .spyOn(cacache.rm, 'entry')
        .mockImplementation((cachePath, key) => {
          if (key === 'expired-error') {
            return Promise.reject(new Error('error'));
          }

          return rmEntry(cachePath, key);
        });

      await cache.destroy();

      expect(logger.trace).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error cleaning up cache entry',
      );
      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).not.toContain('expired-next');
      cacacheRmEntry.mockRestore();
    });

    it('does not read content during cleanup', async () => {
      await cache.set('_test-namespace', 'in-memory', 'value', 5);
      const cacacheGet = vi.spyOn(cacache, 'get');

      await cache.destroy();

      expect(cacacheGet).not.toHaveBeenCalled();
      cacacheGet.mockRestore();
      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).toContain('_test-namespace-in-memory');
    });

    it('does not resurface entries removed for non-positive TTL', async () => {
      await cache.set('_test-namespace', 'removed', 'value', 5);
      await cache.set('_test-namespace', 'removed', 'value', -5);

      await cache.destroy();

      const entries = await cacache.ls(cacheFileName);
      expect(Object.keys(entries)).not.toContain('_test-namespace-removed');
    });
  });
});
