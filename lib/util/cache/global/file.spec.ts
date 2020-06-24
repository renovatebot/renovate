import os from 'os';
import { get, init, set } from './file';

describe('lib/util/cache/global/file', () => {
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
});
