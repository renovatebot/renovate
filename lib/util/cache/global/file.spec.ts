import os from 'os';
import { init } from './file';

describe('lib/util/cache/global/file', () => {
  beforeAll(() => {
    init(os.tmpdir());
  });

  it('gets null', async () => {
    expect(await global.renovateCache.get('test', 'missing-key')).toBeNull();
  });

  it('sets and gets', async () => {
    await global.renovateCache.set('test', 'key', 1234);
    expect(await global.renovateCache.get('test', 'key')).toBe(1234);
  });

  it('expires', async () => {
    await global.renovateCache.set('test', 'key', 1234, -5);
    expect(await global.renovateCache.get('test', 'key')).toBeNull();
  });
});
