import { GlobalConfig } from '../../../config/global';
import { cleanup, get, init, set } from '.';

jest.mock('./file');
jest.mock('./redis');
jest.mock('./sqlite');

describe('util/cache/package/index', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('returns undefined if not initialized', async () => {
    expect(await get('_test-namespace', 'missing-key')).toBeUndefined();
    expect(
      await set('_test-namespace', 'some-key', 'some-value', 5),
    ).toBeUndefined();
    expect(async () => {
      await cleanup({});
    }).not.toThrow();
  });

  it('sets and gets file', async () => {
    await init({ cacheDir: 'some-dir' });
    expect(
      await set('_test-namespace', 'some-key', 'some-value', 1),
    ).toBeUndefined();
    expect(await get('_test-namespace', 'unknown-key')).toBeUndefined();
  });

  it('sets and gets redis', async () => {
    await init({ redisUrl: 'some-url' });
    expect(
      await set('_test-namespace', 'some-key', 'some-value', 1),
    ).toBeUndefined();
    expect(await get('_test-namespace', 'unknown-key')).toBeUndefined();
    expect(await cleanup({ redisUrl: 'some-url' })).toBeUndefined();
  });

  it('sets and gets sqlite', async () => {
    GlobalConfig.set({ experimentalFlags: ['sqlitePackageCache'] });
    await init({ cacheDir: 'some-dir' });
    expect(
      await set('_test-namespace', 'some-key', 'some-value', 1),
    ).toBeUndefined();
    expect(await get('_test-namespace', 'unknown-key')).toBeUndefined();
    expect(await cleanup({ redisUrl: 'some-url' })).toBeUndefined();
  });
});
