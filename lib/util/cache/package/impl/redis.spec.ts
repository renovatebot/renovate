import { createClient, createCluster } from '@redis/client';
import { DateTime } from 'luxon';
import { compressToBase64 } from '../../../compress.ts';
import { PackageCacheRedis, normalizeRedisUrl } from './redis.ts';

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
    };

    beforeEach(() => {
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
      it('returns compressed cached value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };
        const compressed = await compressToBase64(JSON.stringify(value));

        const payload = JSON.stringify({
          compress: true,
          value: compressed,
          expiry: DateTime.local().plus({ minutes: 5 }),
        });
        clientMock.get.mockResolvedValueOnce(payload);

        expect(await cache.get('_test-namespace', 'key')).toEqual(value);
      });

      it('returns uncompressed value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };

        const payload = JSON.stringify({
          compress: false,
          value,
          expiry: DateTime.local().plus({ minutes: 5 }),
        });
        clientMock.get.mockResolvedValueOnce(payload);

        expect(await cache.get('_test-namespace', 'key')).toEqual(value);
      });

      it('removes expired cached entry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        const payload = JSON.stringify({
          expiry: DateTime.local().minus({ minutes: 1 }),
        });
        clientMock.get.mockResolvedValueOnce(payload);

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('returns undefined for missing expiry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        const payload = JSON.stringify({ compress: false, value: 1234 });
        clientMock.get.mockResolvedValueOnce(payload);

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('returns undefined for invalid expiry', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        const payload = JSON.stringify({
          compress: false,
          value: 1234,
          expiry: 'not-a-date',
        });
        clientMock.get.mockResolvedValueOnce(payload);

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
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
      it('compresses and stores value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        await cache.set('_test-namespace', 'key', { foo: 'bar' }, 10);

        expect(clientMock.set).toHaveBeenCalledWith(
          'p:_test-namespace-key',
          expect.stringContaining('"compress":true'),
          { EX: 600 },
        );
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
