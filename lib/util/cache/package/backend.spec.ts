import * as backend from './backend.ts';
import { PackageCacheFile } from './impl/file.ts';
import { PackageCacheRedis } from './impl/redis.ts';
import { PackageCacheSqlite } from './impl/sqlite.ts';

vi.mock('./impl/file.ts');
vi.mock('./impl/redis.ts');
vi.mock('./impl/sqlite.ts');

function mockBackend(): {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe('util/cache/package/backend', () => {
  let fileBackend: ReturnType<typeof mockBackend>;
  let redisBackend: ReturnType<typeof mockBackend>;
  let sqliteBackend: ReturnType<typeof mockBackend>;

  beforeEach(() => {
    delete process.env.RENOVATE_X_SQLITE_PACKAGE_CACHE;
    fileBackend = mockBackend();
    redisBackend = mockBackend();
    sqliteBackend = mockBackend();
    vi.mocked(PackageCacheFile.create).mockReturnValue(
      fileBackend as unknown as PackageCacheFile,
    );
    vi.mocked(PackageCacheRedis.create).mockResolvedValue(
      redisBackend as unknown as PackageCacheRedis,
    );
    vi.mocked(PackageCacheSqlite.create).mockResolvedValue(
      sqliteBackend as unknown as PackageCacheSqlite,
    );
  });

  afterEach(async () => {
    await backend.destroy();
  });

  it('returns undefined when not initialized', async () => {
    expect(backend.getCacheType()).toBeUndefined();
    expect(await backend.get('_test-namespace', 'missing-key')).toBeUndefined();
  });

  it('silently ignores set when not initialized', async () => {
    await expect(
      backend.set('_test-namespace', 'key', 'value', 5),
    ).resolves.toBeUndefined();
  });

  it('silently ignores destroy when not initialized', async () => {
    await expect(backend.destroy()).resolves.toBeUndefined();
  });

  it('initializes file backend', async () => {
    await backend.init({ cacheDir: 'some-dir' });

    expect(PackageCacheFile.create).toHaveBeenCalledWith('some-dir');
    expect(backend.getCacheType()).toBe('file');
  });

  it('initializes redis backend', async () => {
    await backend.init({ redisUrl: 'some-url' });

    expect(PackageCacheRedis.create).toHaveBeenCalledWith(
      'some-url',
      undefined,
    );
    expect(backend.getCacheType()).toBe('redis');
  });

  it('initializes sqlite backend', async () => {
    process.env.RENOVATE_X_SQLITE_PACKAGE_CACHE = 'true';

    await backend.init({ cacheDir: 'some-dir' });

    expect(PackageCacheSqlite.create).toHaveBeenCalledWith('some-dir');
    expect(backend.getCacheType()).toBe('sqlite');
  });

  it('delegates get and set to backend instance', async () => {
    await backend.init({ cacheDir: 'some-dir' });

    await backend.get('_test-namespace', 'some-key');

    expect(fileBackend.get).toHaveBeenCalledWith('_test-namespace', 'some-key');

    await backend.set('_test-namespace', 'some-key', 'some-value', 5);

    expect(fileBackend.set).toHaveBeenCalledWith(
      '_test-namespace',
      'some-key',
      'some-value',
      5,
    );
  });

  it('re-init destroys previous backend', async () => {
    await backend.init({ redisUrl: 'some-url' });

    expect(backend.getCacheType()).toBe('redis');

    await backend.init({ cacheDir: 'some-dir' });

    expect(redisBackend.destroy).toHaveBeenCalled();
    expect(backend.getCacheType()).toBe('file');

    await backend.get('_test-namespace', 'key');

    expect(redisBackend.get).not.toHaveBeenCalled();
    expect(fileBackend.get).toHaveBeenCalled();
  });

  it('clears backend when re-init has no config', async () => {
    await backend.init({ cacheDir: 'some-dir' });

    expect(backend.getCacheType()).toBe('file');

    await backend.init({});

    expect(backend.getCacheType()).toBeUndefined();
    expect(await backend.get('_test-namespace', 'key')).toBeUndefined();
  });

  it('destroys backend and clears state', async () => {
    await backend.init({ redisUrl: 'some-url' });

    expect(backend.getCacheType()).toBe('redis');

    await backend.destroy();

    expect(redisBackend.destroy).toHaveBeenCalled();
    expect(backend.getCacheType()).toBeUndefined();
  });
});
