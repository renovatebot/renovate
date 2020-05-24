import { getName } from '../../../../test/util';
import { get, init, set } from '.';

jest.mock('./file');

describe(getName(__filename), () => {
  it('returns undefined if not initialized', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
    expect(await set('test', 'some-key', 'some-value', 5)).toBeUndefined();
  });
  it('sets and gets', async () => {
    global.renovateCache = { get: jest.fn(), set: jest.fn(), rm: jest.fn() };
    init('some-dir');
    expect(
      await set('some-namespace', 'some-key', 'some-value', 1)
    ).toBeUndefined();
    expect(await get('some-namespace', 'unknown-key')).toBeUndefined();
  });
});
