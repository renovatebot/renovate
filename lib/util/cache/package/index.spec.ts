import { cleanup, get, init, set } from '.';

jest.mock('./file');
jest.mock('./redis');

describe('util/cache/package/index', () => {
  it('returns undefined if not initialized', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
    expect(await set('test', 'some-key', 'some-value', 5)).toBeUndefined();
    expect(async () => {
      await cleanup({});
    }).not.toThrow();
  });

  it('sets and gets file', async () => {
    await init({ cacheDir: 'some-dir' });
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1),
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
  });

  it('sets and gets redis', async () => {
    await init({ redisUrl: 'some-url' });
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1),
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
    expect(await cleanup({ redisUrl: 'some-url' })).toBeUndefined();
  });
});
