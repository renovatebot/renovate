import { clearRepoCache, getRepoCached, setRepoCached } from './cache';

describe('getRepoCache', () => {
  it('sets and gets repo cache', () => {
    setRepoCached('key', 'value');
    expect(getRepoCached('key')).toEqual('value');
  });
  it('clears repo cache', () => {
    clearRepoCache();
  });
});
