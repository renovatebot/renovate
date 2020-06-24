import os from 'os';
import { get, init, set } from './file';

describe('lib/util/cache/global/file', () => {
  beforeAll(() => {
    init(os.tmpdir());
  });

  it('gets null', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
  });

  it('sets and gets', async () => {
    await set('test', 'key', 1234);
    expect(await get('test', 'key')).toBe(1234);
  });

  it('expires', async () => {
    await set('test', 'key', 1234, -5);
    expect(await get('test', 'key')).toBeUndefined();
  });
});
