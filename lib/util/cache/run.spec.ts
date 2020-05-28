import * as runCache from './run';

describe('getRepoCache', () => {
  it('returns undefined if not init', () => {
    expect(runCache.get('key1')).toBeUndefined();
  });
  it('sets and gets repo cache', () => {
    runCache.init();
    runCache.set('key2', 'value');
    expect(runCache.get('key2')).toEqual('value');
  });
  it('resets', () => {
    runCache.init();
    runCache.set('key3', 'value');
    runCache.reset();
    expect(runCache.get('key3')).toBeUndefined();
  });
});
