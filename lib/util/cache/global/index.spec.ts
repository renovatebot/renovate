import { get, init, set } from '.';

jest.mock('./file');

describe('lib/util/cache/global/index', () => {
  it('returns undefined if not initialized', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
    expect(await set('test', 'some-key', 'some-value', 5)).toBeUndefined();
  });
  it('calls to file cache', async () => {
    init('/tmp/some-cache-dir');
    expect(await set('test', 'some-key1', 'some-value', 5)).toBeUndefined();
    expect(await get('test', 'some-key2')).toBeUndefined();
  });
});
