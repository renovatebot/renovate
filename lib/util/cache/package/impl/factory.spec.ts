import { getEnv } from '../../../env';
import { PackageCacheFile } from './file';
import { PackageCacheRedis } from './redis';
import { PackageCacheSqlite } from './sqlite';
import { PackageCache } from './index';
import { partial } from '~test/util';

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

  describe('PackageCache.create', () => {
    describe('Memory-only backend', () => {
      it('creates memory-only cache when no backend configured', async () => {
        const cache = await PackageCache.create({});

        expect(cache).toBeInstanceOf(PackageCache);
        expect(cache.getType()).toBeUndefined();
      });
    });

    describe('Redis backend', () => {
      it('instantiates redis backend when redisUrl is configured', async () => {
        const backend = partial<PackageCacheRedis>({ destroy: vi.fn() });
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
    });

    describe('SQLite backend', () => {
      it('instantiates sqlite backend when RENOVATE_X_SQLITE_PACKAGE_CACHE is enabled', async () => {
        vi.mocked(getEnv).mockReturnValue({
          RENOVATE_X_SQLITE_PACKAGE_CACHE: 'true',
        });
        const backend = partial<PackageCacheSqlite>({ destroy: vi.fn() });
        vi.mocked(PackageCacheSqlite.create).mockResolvedValue(backend);

        const cache = await PackageCache.create({ cacheDir: '/tmp' });

        expect(cache).toBeInstanceOf(PackageCache);
        expect(cache.getType()).toBe('sqlite');
        expect(PackageCacheSqlite.create).toHaveBeenCalledWith('/tmp');
      });
    });

    describe('File backend', () => {
      it('instantiates file backend when cacheDir is configured', async () => {
        const backend = partial<PackageCacheFile>({ destroy: vi.fn() });
        vi.mocked(PackageCacheFile.create).mockReturnValue(backend);

        const cache = await PackageCache.create({ cacheDir: '/tmp' });

        expect(cache).toBeInstanceOf(PackageCache);
        expect(cache.getType()).toBe('file');
        expect(PackageCacheFile.create).toHaveBeenCalledWith('/tmp');
      });
    });
  });
});
