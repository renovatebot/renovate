import * as memCache from '.';

describe('util/cache/memory/index', () => {
  it('returns undefined if not init', () => {
    expect(memCache.get('key1')).toBeUndefined();
  });

  it('sets and gets repo cache for strings', () => {
    memCache.init();
    memCache.set('key2', 'value');
    expect(memCache.get('key2')).toBe('value');
  });

  it('sets and gets repo cache for objects', () => {
    memCache.init();
    const obj = { some: 'thing' };
    memCache.set('key3', obj);
    expect(memCache.get('key3')).toBe(obj);
  });

  it('sets and gets repo cache for promises', () => {
    memCache.init();
    const promise = new Promise(() => undefined);
    memCache.set('key4', promise);
    expect(memCache.get('key4')).toBe(promise);
  });

  it('sets and gets repo cache for functions', () => {
    memCache.init();
    const fn = () => undefined;
    memCache.set('key5', fn);
    expect(memCache.get('key5')).toBe(fn);
  });

  it('does not set and gets repo cache for null or undefined', () => {
    memCache.init();
    memCache.set('key6', null);
    expect(memCache.get('key6')).toBeUndefined();
    memCache.set('key7', undefined);
    expect(memCache.get('key7')).toBeUndefined();
  });

  it('resets', () => {
    memCache.init();
    memCache.set('key8', 'value');
    memCache.reset();
    expect(memCache.get('key8')).toBeUndefined();
  });
});
