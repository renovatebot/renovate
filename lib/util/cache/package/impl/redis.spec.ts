import { createClient, createCluster } from '@redis/client';
import { DateTime } from 'luxon';
import { logger as _logger } from '~test/util.ts';
import { compressToBase64 } from '../../../compress.ts';
import { encodeEntry } from '../codec.ts';
import { PackageCacheRedis, normalizeRedisUrl } from './redis.ts';

const { logger } = _logger;

vi.mock('@redis/client');

describe('util/cache/package/impl/redis', () => {
  describe('normalizeRedisUrl', () => {
    it.each`
      url                                                | expected
      ${'redis://user:password@localhost:6379'}          | ${'redis://user:password@localhost:6379'}
      ${'rediss://user:password@localhost:6379'}         | ${'rediss://user:password@localhost:6379'}
      ${'redis+cluster://user:password@localhost:6379'}  | ${'redis://user:password@localhost:6379'}
      ${'rediss+cluster://user:password@localhost:6379'} | ${'rediss://user:password@localhost:6379'}
    `('rewrites $url to $expected', ({ url, expected }) => {
      expect(normalizeRedisUrl(url)).toBe(expected);
    });
  });

  describe('PackageCacheRedis', () => {
    const clientMock = {
      connect: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      destroy: vi.fn(),
      withTypeMapping: vi.fn(),
    };

    beforeEach(() => {
      clientMock.withTypeMapping.mockReturnValue(clientMock);
      vi.mocked(createClient).mockReturnValue(
        clientMock as unknown as ReturnType<typeof createClient>,
      );
      vi.mocked(createCluster).mockReturnValue(
        clientMock as unknown as ReturnType<typeof createCluster>,
      );
    });

    describe('create', () => {
      it('initializes single-node client and connects', async () => {
        await PackageCacheRedis.create('redis://host', undefined);

        expect(createClient).toHaveBeenCalledWith({
          pingInterval: 30000,
          socket: { reconnectStrategy: expect.any(Function) },
          url: 'redis://host',
        });
        expect(clientMock.connect).toHaveBeenCalled();
        expect(clientMock.withTypeMapping).toHaveBeenCalled();

        const reconnectStrategy = vi.mocked(createClient).mock.calls[0][0]!
          .socket!.reconnectStrategy as (retries: number) => number;
        expect(reconnectStrategy(1)).toBe(100);
        expect(reconnectStrategy(100)).toBe(3000);
      });

      it('initializes single-node client with secure url', async () => {
        await PackageCacheRedis.create('rediss://host', '');

        expect(createClient).toHaveBeenCalledWith(
          expect.objectContaining({ url: 'rediss://host' }),
        );
      });

      it('initializes cluster client', async () => {
        await PackageCacheRedis.create('redis+cluster://host', '');

        expect(createCluster).toHaveBeenCalledWith({
          rootNodes: [
            {
              pingInterval: 30000,
              socket: { reconnectStrategy: expect.any(Function) },
              url: 'redis://host',
            },
          ],
        });
      });

      it('initializes cluster client with username and password', async () => {
        await PackageCacheRedis.create('redis+cluster://user:pass@host', '');

        expect(createCluster).toHaveBeenCalledWith({
          defaults: { username: 'user', password: 'pass' },
          rootNodes: [
            expect.objectContaining({
              url: 'redis://user:pass@host',
            }),
          ],
        });
      });

      it('initializes cluster client with username only', async () => {
        await PackageCacheRedis.create('redis+cluster://user@host', '');

        expect(createCluster).toHaveBeenCalledWith({
          defaults: { username: 'user' },
          rootNodes: [
            expect.objectContaining({
              url: 'redis://user@host',
            }),
          ],
        });
      });

      it('initializes cluster client with password only', async () => {
        await PackageCacheRedis.create('redis+cluster://:pass@host', '');

        expect(createCluster).toHaveBeenCalledWith({
          defaults: { password: 'pass' },
          rootNodes: [
            expect.objectContaining({
              url: 'redis://:pass@host',
            }),
          ],
        });
      });
    });

    describe('get', () => {
      it('returns value from cache payload', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };
        const payloadValue = await compressToBase64(JSON.stringify(value));

        const payload = JSON.stringify({
          value: payloadValue,
          expiry: DateTime.local().plus({ minutes: 5 }),
        });
        clientMock.get.mockResolvedValueOnce(Buffer.from(payload));

        expect(await cache.get('_test-namespace', 'key')).toEqual(value);
      });

      it('returns value from envelope payload', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };

        clientMock.get.mockResolvedValueOnce(
          await encodeEntry(value, DateTime.local()),
        );

        expect(await cache.get('_test-namespace', 'key')).toEqual(value);
      });

      it('removes expired cached entry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };
        const payloadValue = await compressToBase64(JSON.stringify(value));

        const payload = JSON.stringify({
          value: payloadValue,
          expiry: DateTime.local().minus({ minutes: 1 }),
        });
        clientMock.get.mockResolvedValueOnce(Buffer.from(payload));

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('returns undefined for missing expiry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };
        const payloadValue = await compressToBase64(JSON.stringify(value));

        const payload = JSON.stringify({ value: payloadValue });
        clientMock.get.mockResolvedValueOnce(Buffer.from(payload));

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('returns undefined for invalid expiry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        const payload = JSON.stringify({
          value: 1234,
          expiry: 'not-a-date',
        });
        clientMock.get.mockResolvedValueOnce(Buffer.from(payload));

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('removes invalid entries', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        clientMock.get.mockResolvedValueOnce(Buffer.from('garbage'));

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(logger.once.debug).toHaveBeenCalledWith(
          { err: expect.any(Error) },
          'Error while reading package cache value',
        );
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('returns undefined when invalid entry removal fails', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        clientMock.get.mockResolvedValueOnce(Buffer.from('garbage'));
        clientMock.del.mockRejectedValueOnce(new Error('delete failed'));

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(logger.once.debug).toHaveBeenCalledWith(
          { err: expect.any(Error) },
          'Error while removing package cache value',
        );
      });

      it('returns undefined on cache miss', async () => {
        const cache = await PackageCacheRedis.create('redis://host', '');

        clientMock.get.mockResolvedValueOnce(null);

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
      });

      it('returns undefined on error', async () => {
        const cache = await PackageCacheRedis.create('redis://host', '');

        clientMock.get.mockRejectedValueOnce(new Error('connection lost'));

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
      });
    });

    describe('set', () => {
      it('stores payload with value and expiry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        await cache.set('_test-namespace', 'key', { foo: 'bar' }, 10);

        const [, rawPayload] = vi.mocked(clientMock.set).mock.calls[0];
        const payload = JSON.parse(rawPayload as string);

        expect(clientMock.set).toHaveBeenCalledWith(
          'p:_test-namespace-key',
          expect.any(String),
          { EX: 600 },
        );
        expect(Object.keys(payload).sort()).toEqual(['expiry', 'value']);
        expect(payload.value).toBeString();
        expect(payload.expiry).toBeString();
      });

      it('deletes entry with negative TTL', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        await cache.set('_test-namespace', 'key', { foo: 'bar' }, -1);

        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
        expect(clientMock.set).not.toHaveBeenCalled();
      });

      it('handles set error gracefully', async () => {
        const cache = await PackageCacheRedis.create('redis://host', '');

        clientMock.set.mockRejectedValueOnce(new Error('write error'));

        await expect(
          cache.set('_test-namespace', 'key', 'val', 5),
        ).resolves.not.toThrow();
      });
    });

    describe('destroy', () => {
      it('destroys the client', async () => {
        const cache = await PackageCacheRedis.create('redis://host', '');

        await cache.destroy();

        expect(clientMock.destroy).toHaveBeenCalled();
      });

      it('handles destroy error gracefully', async () => {
        const cache = await PackageCacheRedis.create('redis://host', '');

        clientMock.destroy.mockImplementation(() => {
          throw new Error('destroy failed');
        });

        await expect(cache.destroy()).resolves.toBeUndefined();
      });
    });
  });
});
