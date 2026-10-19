import * as memCache from './index.ts';

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

  describe('cleanDatasourceKeys', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('does nothing if no matching keys exist', () => {
      memCache.set('normal-key', 'value');
      memCache.set('another-key', 'data');
      memCache.cleanDatasourceKeys();
      expect(memCache.get('normal-key')).toBe('value');
      expect(memCache.get('another-key')).toBe('data');
    });

    it('removes keys that start with datasource-releases', () => {
      memCache.set('datasource-mem:releases:npm', 'value');
      memCache.set('normal-key', 'data');
      memCache.cleanDatasourceKeys();
      expect(memCache.get('datasource-mem:releases:npm')).toBeUndefined();
      expect(memCache.get('normal-key')).toBe('data');
    });
  });
});
