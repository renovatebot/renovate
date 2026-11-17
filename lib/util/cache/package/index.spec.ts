import * as hostRules from '../../host-rules.ts';
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
    await expect(
      get('_test-namespace', 'missing-key'),
    ).resolves.toBeUndefined();

    await expect(
      set('_test-namespace', 'some-key', 'some-value', 5),
    ).resolves.toBeUndefined();

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

  it('never hands URL credentials to the backend', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('redis');
    const key = 'getReleases:https://user:pass@example.com:some-package';

    await setWithRawTtl('_test-namespace', key, 'some-value', 5);
    await get('_test-namespace', key);

    const [, storedKey] = vi.mocked(backend.set).mock.calls[0];
    expect(storedKey).not.toContain('user:pass@');
    expect(storedKey).toStartWith('getReleases:https://');
    expect(storedKey).toEndWith('@example.com:some-package');
  });

  it('reads back what it wrote under a key with credentials', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('redis');
    const key = 'https://user:pass@example.com';

    await setWithRawTtl('_test-namespace', key, 'some-value', 5);

    await expect(get('_test-namespace', key)).resolves.toBe('some-value');
    expect(backend.get).not.toHaveBeenCalled();
  });

  it('stores a URL under a separate key per detached URL credentials', async () => {
    vi.mocked(backend.getCacheType).mockReturnValue('redis');
    const key = 'getReleases:https://example.com/maven:some-package';

    await setWithRawTtl('_test-namespace', key, 'no-credentials', 5);
    hostRules.detachUrlCredentials('https://user:one@example.com/maven', [
      'maven',
    ]);
    await setWithRawTtl('_test-namespace', key, 'first', 5);
    hostRules.clear();
    hostRules.detachUrlCredentials('https://user:two@example.com/maven', [
      'maven',
    ]);
    await setWithRawTtl('_test-namespace', key, 'second', 5);

    await expect(get('_test-namespace', key)).resolves.toBe('second');
    hostRules.clear();
    await expect(get('_test-namespace', key)).resolves.toBe('no-credentials');
    const storedKeys = vi.mocked(backend.set).mock.calls.map(([, k]) => k);
    expect(storedKeys[0]).toBe(key);
    expect(new Set(storedKeys).size).toBe(3);
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
