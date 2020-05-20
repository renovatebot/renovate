import * as runCache from './run';

describe('getRepoCache', () => {
  it('sets and gets repo cache', () => {
    runCache.set('key', 'value');
    expect(runCache.get('key')).toEqual('value');
  });
  it('clears repo cache', () => {
    expect(() => runCache.clear()).not.toThrow();
  });
});
