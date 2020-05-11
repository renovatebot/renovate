import { clear, get, set } from './run';

describe('getRepoCache', () => {
  it('sets and gets repo cache', () => {
    set('key', 'value');
    expect(get('key')).toEqual('value');
  });
  it('clears repo cache', () => {
    clear();
  });
});
