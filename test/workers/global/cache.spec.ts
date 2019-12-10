import os from 'os';
import { init } from '../../../lib/workers/global/cache';

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

  it('deletes', async () => {
    await global.renovateCache.set('test', 'key', 1234);
    await global.renovateCache.rmAll();
    expect(await global.renovateCache.get('test', 'key')).toBeNull();
  });
});
