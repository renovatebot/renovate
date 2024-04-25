import os from 'node:os';
import cacache from 'cacache';
import { cleanup, get, init, set } from './file';

describe('util/cache/package/file', () => {
  it('returns if uninitiated', async () => {
    await set('_test-namespace', 'key', 1234);
    expect(await get('_test-namespace', 'key')).toBeUndefined();
  });

  it('gets null', async () => {
    init(os.tmpdir());
    expect(await get('_test-namespace', 'missing-key')).toBeUndefined();
  });

  it('sets and gets', async () => {
    init(os.tmpdir());
    await set('_test-namespace', 'key', 1234);
    expect(await get('_test-namespace', 'key')).toBe(1234);
  });

  it('expires', async () => {
    init(os.tmpdir());
    await set('_test-namespace', 'key', 1234, -5);
    expect(await get('_test-namespace', 'key')).toBeUndefined();
  });

  it('cleans up', async () => {
    const cacheFileName = init(os.tmpdir());
    await set('_test-namespace', 'valid', 1234);
    await set('_test-namespace', 'expired', 1234, -5);
    await cacache.put(cacheFileName, 'invalid', 'not json');
    const expiredDigest = (
      await cacache.get(cacheFileName, '_test-namespace-expired')
    ).integrity;
    await cleanup();
    const entries = await cacache.ls(cacheFileName);
    expect(Object.keys(entries)).toEqual(['_test-namespace-valid']);
    await expect(
      cacache.get.byDigest(cacheFileName, expiredDigest),
    ).rejects.toThrow('ENOENT');
  });
});
