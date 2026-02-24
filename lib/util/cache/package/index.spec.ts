import { partial } from '~test/util.ts';
import * as backend from './backend.ts';
import type { PackageCacheBase } from './impl/base.ts';
import * as index from './index.ts';

vi.unmock('./index.ts');
vi.mock('./backend.ts');

describe('util/cache/package/index', () => {
  beforeEach(async () => {
    vi.mocked(backend.getBackend).mockReturnValue(undefined);
    await index.cleanup({});
  });

  it('returns undefined on get without backend', async () => {
    expect(await index.get('_test-namespace', 'missing-key')).toBeUndefined();
  });

  it('stores and retrieves via L1 without backend', async () => {
    await index.set('_test-namespace', 'some-key', 'some-value', 5);

    const result = await index.get('_test-namespace', 'some-key');

    expect(result).toBe('some-value');
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

  it('delegates cleanup to packageCache.destroy', async () => {
    const mockBackend = partial<PackageCacheBase>({
      get: vi.fn(),
      set: vi.fn(),
      destroy: vi.fn(),
    });
    vi.mocked(backend.init).mockResolvedValue(undefined);
    vi.mocked(backend.getBackend).mockReturnValue(mockBackend);
    await index.init({});

    await index.cleanup({});

    expect(mockBackend.destroy).toHaveBeenCalled();
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
    vi.mocked(backend.destroy).mockRejectedValue(new Error('destroy failed'));

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
