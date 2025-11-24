import { DateTime } from 'luxon';
import { createClient, createCluster } from 'redis';
import { compressToBase64 } from '../../../compress';
import { PackageCacheRedis, normalizeRedisUrl } from './redis';

vi.mock('redis');

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

  describe('RedisCache', () => {
    const clientMock = {
      connect: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      destroy: vi.fn(),
    };

    beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(createClient).mockReturnValue(clientMock as any);
      vi.mocked(createCluster).mockReturnValue(clientMock as any);
    });

    describe('create', () => {
      it('throws if url is empty', async () => {
        await expect(PackageCacheRedis.create('')).rejects.toThrow();
      });

      it('initializes client and connects', async () => {
        await PackageCacheRedis.create('redis://host');
        expect(createClient).toHaveBeenCalledWith({
          pingInterval: 30000,
          socket: { reconnectStrategy: expect.any(Function) },
          url: 'redis://host',
        });
        expect(clientMock.connect).toHaveBeenCalled();

        // Test reconnectStrategy
        const { reconnectStrategy } = vi.mocked(createClient).mock.calls[0][0]!
          .socket as any;
        expect(reconnectStrategy(1)).toBe(100);
        expect(reconnectStrategy(100)).toBe(3000);
      });

      it('initializes cluster client', async () => {
        await PackageCacheRedis.create('redis+cluster://host');
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

      it('initializes cluster client with auth', async () => {
        await PackageCacheRedis.create('redis+cluster://user:pass@host');
        expect(createCluster).toHaveBeenCalledWith({
          defaults: {
            password: 'pass',
            username: 'user',
          },
          rootNodes: [
            {
              pingInterval: 30000,
              socket: { reconnectStrategy: expect.any(Function) },
              url: 'redis://user:pass@host',
            },
          ],
        });
      });

      it('initializes cluster client with password only', async () => {
        await PackageCacheRedis.create('redis+cluster://:pass@host');
        expect(createCluster).toHaveBeenCalledWith({
          defaults: {
            password: 'pass',
          },
          rootNodes: [
            {
              pingInterval: 30000,
              socket: { reconnectStrategy: expect.any(Function) },
              url: 'redis://:pass@host',
            },
          ],
        });
      });
    });

    describe('get', () => {
      it('gets cached value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };
        const compressed = await compressToBase64(JSON.stringify(value));

        clientMock.get.mockResolvedValue(
          JSON.stringify({
            compress: true,
            value: compressed,
            expiry: DateTime.local().plus({ minutes: 5 }),
          }),
        );

        expect(await cache.get('_test-namespace', 'key')).toEqual(value);
      });

      it('handles legacy uncompressed value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        const value = { foo: 'bar' };

        clientMock.get.mockResolvedValue(
          JSON.stringify({
            compress: false,
            value,
            expiry: DateTime.local().plus({ minutes: 5 }),
          }),
        );

        expect(await cache.get('_test-namespace', 'key')).toEqual(value);
      });

      it('expires cached value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');

        clientMock.get.mockResolvedValue(
          JSON.stringify({
            expiry: DateTime.local().minus({ minutes: 1 }),
          }),
        );

        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
      });

      it('handles errors', async () => {
        const cache = await PackageCacheRedis.create('redis://host');
        clientMock.get.mockRejectedValue(new Error('foo'));
        expect(await cache.get('_test-namespace', 'key')).toBeUndefined();
      });
    });

    describe('set', () => {
      it('sets cached value', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        await cache.set('_test-namespace', 'key', { foo: 'bar' }, 10);

        expect(clientMock.set).toHaveBeenCalledWith(
          'p:_test-namespace-key',
          expect.stringContaining('"compress":true'),
          { EX: 600 },
        );
      });

      it('handles negative TTL', async () => {
        const cache = await PackageCacheRedis.create('redis://host', 'p:');
        await cache.set('_test-namespace', 'key', { foo: 'bar' }, -1);

        expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
        expect(clientMock.set).not.toHaveBeenCalled();
      });

      it('handles errors', async () => {
        const cache = await PackageCacheRedis.create('redis://host');
        clientMock.set.mockRejectedValue(new Error('foo'));
        await expect(
          cache.set('_test-namespace', 'key', 'val', 5),
        ).resolves.not.toThrow();
      });
    });

    describe('destroy', () => {
      it('handles errors', async () => {
        const cache = await PackageCacheRedis.create('redis://host');
        clientMock.destroy.mockReturnValue(new Error('foo'));
        await expect(cache.destroy()).resolves.not.toThrow();
      });
    });
  });
});
