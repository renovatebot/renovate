import { getEnv } from '../../../env';
import { PackageCacheFile } from './file';
import { PackageCacheRedis } from './redis';
import { PackageCacheSqlite } from './sqlite';
import { PackageCache } from './index';

vi.mock('../../../env', () => ({
  getEnv: vi.fn(() => ({})),
}));
vi.mock('./file');
vi.mock('./redis');
vi.mock('./sqlite');

describe('util/cache/package/impl/factory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getEnv).mockReturnValue({});
  });

  describe('create', () => {
    it('returns instance when no cache configured', async () => {
      const cache = await PackageCache.create({});
      expect(cache).toBeInstanceOf(PackageCache);
      expect(cache.getType()).toBeUndefined();
    });

    it('creates redis cache', async () => {
      const backend = { destroy: vi.fn() } as any;
      vi.mocked(PackageCacheRedis.create).mockResolvedValue(backend);
      const cache = await PackageCache.create({
        redisUrl: 'redis://localhost',
        redisPrefix: 'prefix',
      });
      expect(cache).toBeInstanceOf(PackageCache);
      expect(cache.getType()).toBe('redis');
      expect(PackageCacheRedis.create).toHaveBeenCalledWith(
        'redis://localhost',
        'prefix',
      );
    });

    it('creates sqlite cache', async () => {
      vi.mocked(getEnv).mockReturnValue({
        RENOVATE_X_SQLITE_PACKAGE_CACHE: 'true',
      });
      const backend = { destroy: vi.fn() } as any;
      vi.mocked(PackageCacheSqlite.create).mockResolvedValue(backend);
      const cache = await PackageCache.create({ cacheDir: '/tmp' });
      expect(cache).toBeInstanceOf(PackageCache);
      expect(cache.getType()).toBe('sqlite');
      expect(PackageCacheSqlite.create).toHaveBeenCalledWith('/tmp');
    });

    it('creates file cache', async () => {
      const backend = { destroy: vi.fn() } as any;
      vi.mocked(PackageCacheFile.create).mockReturnValue(backend);
      const cache = await PackageCache.create({ cacheDir: '/tmp' });
      expect(cache).toBeInstanceOf(PackageCache);
      expect(cache.getType()).toBe('file');
      expect(PackageCacheFile.create).toHaveBeenCalledWith('/tmp');
    });
  });
});
