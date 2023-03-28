import os from 'node:os';
import cacache from 'cacache';
import { cleanup, get, init, set } from './file';

describe('util/cache/package/file', () => {
  it('returns if uninitiated', async () => {
    await set('test', 'key', 1234);
    expect(await get('test', 'key')).toBeUndefined();
  });

  it('gets null', async () => {
    init(os.tmpdir());
    expect(await get('test', 'missing-key')).toBeUndefined();
  });

  it('sets and gets', async () => {
    init(os.tmpdir());
    await set('test', 'key', 1234);
    expect(await get('test', 'key')).toBe(1234);
  });

  it('expires', async () => {
    init(os.tmpdir());
    await set('test', 'key', 1234, -5);
    expect(await get('test', 'key')).toBeUndefined();
  });

  it('cleans up', async () => {
    const cacheFileName = init(os.tmpdir());
    await set('test', 'valid', 1234);
    await set('test', 'expired', 1234, -5);
    await cacache.put(cacheFileName, 'invalid', 'not json');
    await cleanup();
    const entries = await cacache.ls(cacheFileName);
    expect(Object.keys(entries)).toEqual(['test-valid']);
  });
});
