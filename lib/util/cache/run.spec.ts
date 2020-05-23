import * as runCache from './run';

describe('getRepoCache', () => {
  it('returns undefined if not init', () => {
    expect(runCache.get('key')).toBeUndefined();
  });
  it('sets and gets repo cache', () => {
    runCache.init();
    runCache.set('key', 'value');
    expect(runCache.get('key')).toEqual('value');
  });
});
