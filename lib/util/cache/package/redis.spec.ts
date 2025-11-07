import { createClient, createCluster } from 'redis';
import { init, normalizeRedisUrl } from './redis';

vi.mock('redis');

describe('util/cache/package/redis', () => {
  describe('normalizeRedisUrl', () => {
    it('leaves standard Redis URL alone', () => {
      const url = 'redis://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(url);
    });

    it('leaves secure Redis URL alone', () => {
      const url = 'rediss://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(url);
    });

    it('rewrites standard Redis Cluster URL', () => {
      const url = 'redis+cluster://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(
        'redis://user:password@localhost:6379',
      );
    });

    it('rewrites secure Redis Cluster URL', () => {
      const url = 'rediss+cluster://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(
        'rediss://user:password@localhost:6379',
      );
    });
  });

  describe('init', () => {
    beforeEach(() => {
      const mockClient = { connect: vi.fn() } as unknown as ReturnType<
        typeof createClient
      >;
      vi.mocked(createClient).mockReturnValueOnce(mockClient);

      const mockCluster = { connect: vi.fn() } as unknown as ReturnType<
        typeof createCluster
      >;
      vi.mocked(createCluster).mockReturnValueOnce(mockCluster);
    });

    it('calls createClient with url', async () => {
      const url = 'redis://user:password@localhost:6379';
      await init(url, '');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url }),
      );
    });

    it('calls createClient with secure url', async () => {
      const url = 'rediss://user:password@localhost:6379';
      await init(url, '');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url }),
      );
    });

    it('calls createCluster with rewritten url', async () => {
      const url = 'redis+cluster://user:password@localhost:6379';
      await init(url, '');
      expect(createCluster).toHaveBeenCalledWith({
        rootNodes: [
          expect.objectContaining({
            url: 'redis://user:password@localhost:6379',
          }),
        ],
        defaults: {
          username: 'user',
          password: 'password',
        },
      });
    });

    it('calls createCluster with rewritten secure url', async () => {
      const url = 'rediss+cluster://user:password@localhost:6379';
      await init(url, '');
      expect(createCluster).toHaveBeenCalledWith({
        rootNodes: [
          expect.objectContaining({
            url: 'rediss://user:password@localhost:6379',
          }),
        ],
        defaults: {
          username: 'user',
          password: 'password',
        },
      });
    });

    it('calls createCluster with no username or password if not supplied', async () => {
      const url = 'redis+cluster://localhost:6379';
      await init(url, '');
      expect(createCluster).toHaveBeenCalledWith({
        rootNodes: [
          expect.objectContaining({
            url: 'redis://localhost:6379',
          }),
        ],
      });
    });

    it('calls createCluster with username if supplied', async () => {
      const url = 'redis+cluster://user@localhost:6379';
      await init(url, '');
      expect(createCluster).toHaveBeenCalledWith({
        rootNodes: [
          expect.objectContaining({
            url: 'redis://user@localhost:6379',
          }),
        ],
        defaults: {
          username: 'user',
        },
      });
    });

    it('calls createCluster with password if supplied', async () => {
      const url = 'redis+cluster://:password@localhost:6379';
      await init(url, '');
      expect(createCluster).toHaveBeenCalledWith({
        rootNodes: [
          expect.objectContaining({
            url: 'redis://:password@localhost:6379',
          }),
        ],
        defaults: {
          password: 'password',
        },
      });
    });
  });
});
