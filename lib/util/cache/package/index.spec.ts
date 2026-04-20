import * as memCache from '../memory/index.ts';
import * as backend from './backend.ts';
import {
  cleanup,
  get,
  getCacheType,
  init,
  set,
  setWithRawTtl,
} from './index.ts';

vi.mock('./backend.ts');

describe('util/cache/package/index', () => {
  beforeEach(() => {
    memCache.init();
  });

  afterEach(() => {
    memCache.reset();
  });

  it('returns undefined if not initialized', async () => {
    expect(await get('_test-namespace', 'missing-key')).toBeUndefined();

    expect(
      await set('_test-namespace', 'some-key', 'some-value', 5),
    ).toBeUndefined();

    await expect(cleanup({})).resolves.toBeUndefined();
  });

  it('delegates init to backend', async () => {
    const config = { cacheDir: 'some-dir' };

    await init(config);

    expect(backend.init).toHaveBeenCalledWith(config);
  });

  it('delegates get to backend', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('file');
    vi.mocked(backend.get).mockResolvedValue('cached-value');

    const result = await get('_test-namespace', 'some-key');

    expect(result).toBe('cached-value');
    expect(backend.get).toHaveBeenCalledWith('_test-namespace', 'some-key');
  });

  it('delegates set to backend', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('file');

    await set('_test-namespace', 'some-key', 'some-value', 5);

    expect(backend.set).toHaveBeenCalledWith(
      '_test-namespace',
      'some-key',
      'some-value',
      5,
    );
  });

  it('delegates setWithRawTtl to backend', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('redis');

    await setWithRawTtl('_test-namespace', 'some-key', 'some-value', 10);

    expect(backend.set).toHaveBeenCalledWith(
      '_test-namespace',
      'some-key',
      'some-value',
      10,
    );
  });

  it('deduplicates get via memCache', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('file');
    vi.mocked(backend.get).mockResolvedValue('cached-value');

    const result1 = await get('_test-namespace', 'some-key');
    const result2 = await get('_test-namespace', 'some-key');

    expect(result1).toBe('cached-value');
    expect(result2).toBe('cached-value');
    expect(backend.get).toHaveBeenCalledTimes(1);
  });

  it('setWithRawTtl updates memCache', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('file');

    await setWithRawTtl('_test-namespace', 'some-key', 'new-value', 5);
    const result = await get('_test-namespace', 'some-key');

    expect(result).toBe('new-value');
    expect(backend.get).not.toHaveBeenCalled();
  });

  it('delegates cleanup to backend.destroy', async () => {
    await cleanup({});

    expect(backend.destroy).toHaveBeenCalled();
  });

  it('delegates getCacheType to backend', () => {
    vi.mocked(backend.getCacheType).mockReturnValue('redis');

    expect(getCacheType()).toBe('redis');
  });
});
