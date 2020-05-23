import os from 'os';
import { init } from './file';

describe('lib/workers/global/cache', () => {
  beforeAll(() => {
    init(os.tmpdir());
  });

  it('sets', async () => {
    await global.renovateCache.set('test', 'key', 1234);
    expect(await global.renovateCache.get('test', 'key')).toBe(1234);
  });

  it('expires', async () => {
    await global.renovateCache.set('test', 'key', 1234, -5);
    expect(await global.renovateCache.get('test', 'key')).toBeNull();
  });
});
