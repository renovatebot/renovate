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
      const res = normalizeRedisUrl(url);
      expect(res).toBe(expected);
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
      vi.resetAllMocks();
      vi.mocked(createClient).mockReturnValue(clientMock as never);
      vi.mocked(createCluster).mockReturnValue(clientMock as never);
    });

    describe('create', () => {
      it('rejects with empty url', async () => {
        await expect(PackageCacheRedis.create('')).rejects.toThrow();
      });

      describe('Single client initialization', () => {
        it('initializes client and connects', async () => {
          await PackageCacheRedis.create('redis://host');

          expect(createClient).toHaveBeenCalledWith({
            pingInterval: 30000,
            socket: { reconnectStrategy: expect.any(Function) },
            url: 'redis://host',
          });
          expect(clientMock.connect).toHaveBeenCalled();

          const reconnectStrategy = vi.mocked(createClient).mock.calls[0][0]!
            .socket?.reconnectStrategy as (_: number) => number;
          expect(reconnectStrategy).toBeDefined();
          expect(reconnectStrategy(1)).toBe(100);
          expect(reconnectStrategy(100)).toBe(3000);
        });
      });

      describe('Cluster initialization', () => {
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

        it('initializes cluster client with username and password', async () => {
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
    });

    describe('get', () => {
      describe('Value retrieval', () => {
        it('returns compressed cached value', async () => {
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

          const res = await cache.get('_test-namespace', 'key');
          expect(res).toEqual(value);
        });

        it('returns uncompressed value', async () => {
          const cache = await PackageCacheRedis.create('redis://host', 'p:');
          const value = { foo: 'bar' };

          clientMock.get.mockResolvedValue(
            JSON.stringify({
              compress: false,
              value,
              expiry: DateTime.local().plus({ minutes: 5 }),
            }),
          );

          const res = await cache.get('_test-namespace', 'key');
          expect(res).toEqual(value);
        });
      });

      describe('TTL handling', () => {
        it('removes expired cached entry', async () => {
          const cache = await PackageCacheRedis.create('redis://host', 'p:');

          clientMock.get.mockResolvedValue(
            JSON.stringify({
              expiry: DateTime.local().minus({ minutes: 1 }),
            }),
          );

          const res = await cache.get('_test-namespace', 'key');
          expect(res).toBeUndefined();
          expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
        });
      });

      describe('Error handling', () => {
        it('returns undefined on get error', async () => {
          const cache = await PackageCacheRedis.create('redis://host');
          clientMock.get.mockRejectedValue(new Error('foo'));

          const res = await cache.get('_test-namespace', 'key');
          expect(res).toBeUndefined();
        });
      });
    });

    describe('set', () => {
      describe('Value storage', () => {
        it('compresses and sets cached value', async () => {
          const cache = await PackageCacheRedis.create('redis://host', 'p:');
          await cache.set('_test-namespace', 'key', { foo: 'bar' }, 10);

          expect(clientMock.set).toHaveBeenCalledWith(
            'p:_test-namespace-key',
            expect.stringContaining('"compress":true'),
            { EX: 600 },
          );
        });
      });

      describe('TTL handling', () => {
        it('deletes entry with negative TTL', async () => {
          const cache = await PackageCacheRedis.create('redis://host', 'p:');
          await cache.set('_test-namespace', 'key', { foo: 'bar' }, -1);

          expect(clientMock.del).toHaveBeenCalledWith('p:_test-namespace-key');
          expect(clientMock.set).not.toHaveBeenCalled();
        });
      });

      describe('Error handling', () => {
        it('silently handles set error', async () => {
          const cache = await PackageCacheRedis.create('redis://host');
          clientMock.set.mockRejectedValue(new Error('foo'));

          await expect(
            cache.set('_test-namespace', 'key', 'val', 5),
          ).resolves.not.toThrow();
        });
      });
    });

    describe('destroy', () => {
      it('silently handles destroy error', async () => {
        const cache = await PackageCacheRedis.create('redis://host');
        clientMock.destroy.mockReturnValue(new Error('foo'));

        await expect(cache.destroy()).resolves.not.toThrow();
      });
    });
  });
});
