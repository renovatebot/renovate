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

    it('removes keys that start with datasource-mem:releases:', () => {
      memCache.set('datasource-mem:releases:npm', 'value');
      memCache.set('normal-key', 'data');
      memCache.cleanDatasourceKeys();
      expect(memCache.get('datasource-mem:releases:npm')).toBeUndefined();
      expect(memCache.get('normal-key')).toBe('data');
    });

    it('removes all matching keys while keeping others', () => {
      memCache.set('datasource-mem:releases:npm', 'npm-data');
      memCache.set('datasource-mem:releases:docker', 'docker-data');
      memCache.set('normal-key1', 'normal1');
      memCache.set('normal-key2', 'normal2');

      memCache.cleanDatasourceKeys();

      expect(memCache.get('datasource-mem:releases:npm')).toBeUndefined();
      expect(memCache.get('datasource-mem:releases:docker')).toBeUndefined();
      expect(memCache.get('normal-key1')).toBe('normal1');
      expect(memCache.get('normal-key2')).toBe('normal2');
    });
  });
});
