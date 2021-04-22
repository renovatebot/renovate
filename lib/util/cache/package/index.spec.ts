import { testName } from '../../../../test/util';
import { cleanup, get, init, set } from '.';

jest.mock('./file');
jest.mock('./redis');

describe(testName(), () => {
  it('returns undefined if not initialized', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
    expect(await set('test', 'some-key', 'some-value', 5)).toBeUndefined();
  });
  it('sets and gets file', async () => {
    init({ cacheDir: 'some-dir' });
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1)
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
  });
  it('sets and gets redis', async () => {
    init({ redisUrl: 'some-url' });
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1)
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
    expect(cleanup({ redisUrl: 'some-url' })).toBeUndefined();
  });
});
