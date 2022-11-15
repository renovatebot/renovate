import * as memCache from '.';

describe('util/cache/memory/index', () => {
  it('returns undefined if not init', () => {
    expect(memCache.get('key1')).toBeUndefined();
  });

  it('sets and gets repo cache', () => {
    memCache.init();
    memCache.set('key2', 'value');
    expect(memCache.get('key2')).toBe('value');
  });

  it('resets', () => {
    memCache.init();
    memCache.set('key3', 'value');
    memCache.reset();
    expect(memCache.get('key3')).toBeUndefined();
  });
});
