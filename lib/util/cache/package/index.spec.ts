import { partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import * as backend from './backend.ts';
import type { PackageCacheBase } from './impl/base.ts';
import * as index from './index.ts';

vi.unmock('./index.ts');
vi.mock('./backend.ts');

describe('util/cache/package/index', () => {
  beforeEach(async () => {
    vi.mocked(backend.getBackend).mockReturnValue(undefined);
    vi.mocked(backend.destroy).mockResolvedValue(undefined);
    await index.cleanup({});
  });

  it('returns undefined on get without backend', async () => {
    await expect(
      index.get('_test-namespace', 'missing-key'),
    ).resolves.toBeUndefined();
  });

  it('reports the configured backend type', () => {
    vi.mocked(backend.getCacheType).mockReturnValue('file');

    expect(index.getCacheType()).toBe('file');
  });

  it('stores and retrieves via L1 without backend', async () => {
    await index.init({});

    await index.set('_test-namespace', 'some-key', 'some-value', 5);

    const result = await index.get('_test-namespace', 'some-key');

    expect(result).toBe('some-value');
  });

  it('uses the configured default memory budget', async () => {
    const { packageCacheMemoryLimit } = getConfig();
    expect(packageCacheMemoryLimit).toBe(64);

    await index.init({ packageCacheMemoryLimit });

    expect(index.packageCache.memory?.maxSize).toBe(64 * 1024 ** 2);
  });

  it('uses the default memory budget when omitted', async () => {
    await index.init({});

    expect(index.packageCache.memory?.maxSize).toBe(64 * 1024 ** 2);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    'rejects invalid memory limit %s',
    async (packageCacheMemoryLimit) => {
      await expect(index.init({ packageCacheMemoryLimit })).rejects.toThrow(
        'packageCacheMemoryLimit must be a non-negative integer in MiB',
      );
      expect(backend.init).not.toHaveBeenCalled();
    },
  );

  it('applies the configured memory budget', async () => {
    await index.init({ packageCacheMemoryLimit: 1 });

    expect(index.packageCache.memory?.maxSize).toBe(1024 ** 2);
  });

  it('disables L1 when the configured memory budget is zero', async () => {
    await index.init({ packageCacheMemoryLimit: 0 });
    await index.set('_test-namespace', 'a', 'value', 10);

    await expect(index.get('_test-namespace', 'a')).resolves.toBeUndefined();
  });

  it('delegates init to backend and wraps result', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn().mockResolvedValue('backend-value'),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);

    await index.init({ cacheDir: 'some-dir' });

    expect(backend.init).toHaveBeenCalledWith({ cacheDir: 'some-dir' });

    const result = await index.get('_test-namespace', 'some-key');

    expect(result).toBe('backend-value');
  });

  it('delegates cleanup to backend.destroy', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn(),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);
    await index.init({});

    await index.cleanup({});

    expect(backend.destroy).toHaveBeenCalled();
  });

  it('resets packageCache to backendless instance on cleanup', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn().mockResolvedValue('backend-value'),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);

    await index.init({ cacheDir: 'some-dir' });

    const result = await index.get('_test-namespace', 'key');

    expect(result).toBe('backend-value');

    vi.mocked(backend.getBackend).mockReturnValue(undefined);
    await index.cleanup({});

    const resultAfterCleanup = await index.get('_test-namespace', 'key');

    expect(resultAfterCleanup).toBeUndefined();
  });

  it('catches errors during cleanup', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn(),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);
    vi.mocked(backend.destroy).mockRejectedValueOnce(
      new Error('destroy failed'),
    );
    await index.init({});

    await expect(index.cleanup({})).resolves.toBeUndefined();
  });

  it('delegates set to packageCache', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn(),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);

    await index.init({ cacheDir: 'some-dir' });
    await index.set('_test-namespace', 'some-key', 'some-value', 5);

    expect(mockBackend.set).toHaveBeenCalledWith(
      '_test-namespace',
      'some-key',
      'some-value',
      5,
    );
  });

  it('delegates setWithRawTtl to packageCache', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn(),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);

    await index.init({ cacheDir: 'some-dir' });
    await index.setWithRawTtl('_test-namespace', 'some-key', 'some-value', 10);

    expect(mockBackend.set).toHaveBeenCalledWith(
      '_test-namespace',
      'some-key',
      'some-value',
      10,
    );
  });
});
