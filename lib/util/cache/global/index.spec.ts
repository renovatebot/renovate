import { getName } from '../../../../test/util';
import { end, get, init, set } from '.';

jest.mock('./file');
jest.mock('./redis');

describe(getName(__filename), () => {
  it('returns undefined if not initialized', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
    expect(await set('test', 'some-key', 'some-value', 5)).toBeUndefined();
  });
  it('sets and gets file', async () => {
    global.renovateCache = { get: jest.fn(), set: jest.fn(), rm: jest.fn() };
    init({ cacheDir: 'some-dir' });
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1)
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
  });
  it('sets and gets redis', async () => {
    global.renovateCache = { get: jest.fn(), set: jest.fn(), rm: jest.fn() };
    init({ redisUrl: 'some-url' });
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1)
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
    expect(await end({ redisUrl: 'some-url' })).toBeUndefined();
  });
});
