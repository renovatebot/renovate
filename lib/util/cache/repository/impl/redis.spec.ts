import { createClient } from 'redis';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { normalizeRedisUrl } from '../../package/redis';
import type { RepoCacheRecord } from '../schema';
import { RepoCacheRedis } from './redis';
import { fs, partial } from '~test/util';

vi.mock('redis');
vi.mock('../../../../logger');
vi.mock('../../../fs');
vi.mock('../../package/redis');

describe('util/cache/repository/impl/redis', () => {
  const repository = 'org/repo';
  const fingerprint = '0123456789abcdef';
  const repoCache = partial<RepoCacheRecord>({ payload: 'payload' });
  const url = 'redis://localhost:6379';
  const err = new Error('redis error');
  let redisCache: RepoCacheRedis;

  beforeEach(() => {
    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });
    vi.mocked(normalizeRedisUrl).mockImplementation((url) => url);
    redisCache = new RepoCacheRedis(repository, fingerprint, url);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('read()', () => {
    it('successfully reads from redis', async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue(JSON.stringify(repoCache)),
        connect: vi.fn(),
      };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      await expect(redisCache.read()).resolves.toBe(JSON.stringify(repoCache));
    });

    it('returns null when cache is not found', async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue(null),
        connect: vi.fn(),
      };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      await expect(redisCache.read()).resolves.toBeNull();
    });

    it('handles redis read errors gracefully', async () => {
      const mockClient = {
        get: vi.fn().mockRejectedValue(err),
        connect: vi.fn(),
      };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      await expect(redisCache.read()).resolves.toBeNull();
    });

    it('reuses existing redis client', async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue(JSON.stringify(repoCache)),
        connect: vi.fn(),
      };
      (redisCache as any).redisClient = mockClient;

      await redisCache.read();
      await redisCache.read();

      expect(createClient).not.toHaveBeenCalled();
      expect(mockClient.connect).toHaveBeenCalledTimes(0);
      expect(mockClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('write()', () => {
    it('successfully writes to redis', async () => {
      const mockClient = {
        set: vi.fn().mockResolvedValue('OK'),
        connect: vi.fn(),
      };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      await expect(redisCache.write(repoCache)).resolves.toBeUndefined();
      expect(mockClient.set).toHaveBeenCalledWith(
        'repository.github.org/repo',
        JSON.stringify(repoCache),
        { EX: 90 * 24 * 60 * 60 },
      );
    });

    it('handles redis write errors gracefully', async () => {
      const mockClient = {
        set: vi.fn().mockRejectedValue(err),
        connect: vi.fn(),
      };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      await expect(redisCache.write(repoCache)).resolves.toBeUndefined();
    });

    it('persists data locally when RENOVATE_X_REPO_CACHE_FORCE_LOCAL is set', async () => {
      process.env.RENOVATE_X_REPO_CACHE_FORCE_LOCAL = 'true';
      const mockClient = {
        set: vi.fn().mockResolvedValue('OK'),
        connect: vi.fn(),
      };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      await redisCache.write(repoCache);

      expect(fs.outputCacheFile).toHaveBeenCalledWith(
        'renovate/repository/github/org/repo.json',
        JSON.stringify(repoCache),
      );
    });
  });

  describe('cleanup()', () => {
    it('successfully disconnects from redis', async () => {
      const mockClient = {
        disconnect: vi.fn().mockResolvedValue(undefined),
      };
      (redisCache as any).redisClient = mockClient;

      await redisCache.cleanup();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('handles disconnect errors gracefully', async () => {
      const mockClient = {
        disconnect: vi.fn().mockRejectedValue(err),
      };
      (redisCache as any).redisClient = mockClient;

      await redisCache.cleanup();

      expect(logger.warn).toHaveBeenCalledWith(
        { err },
        'Redis repository cache end failed',
      );
    });
  });
});
