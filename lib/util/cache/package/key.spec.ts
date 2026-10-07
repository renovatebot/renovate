import { buildCacheKey, getCombinedKey } from './key.ts';

describe('util/cache/package/key', () => {
  describe('getCombinedKey', () => {
    it('works', () => {
      expect(getCombinedKey('_test-namespace', 'foo:bar')).toBe(
        'datasource-mem:pkg-fetch:_test-namespace:foo:bar',
      );
    });
  });

  describe('buildCacheKey', () => {
    it('joins parts with a colon', () => {
      expect(
        buildCacheKey('getReleases', 'https://example.com', 'foo', 1),
      ).toBe('getReleases:https://example.com:foo:1');
    });

    it('keeps the position of undefined, null and empty parts', () => {
      expect(buildCacheKey(undefined, 'foo', null, '', 'bar', 0)).toBe(
        ':foo:::bar:0',
      );
    });

    it('differs for an empty middle part and a shorter key', () => {
      expect(buildCacheKey('a', '', 'b')).toBe('a::b');
      expect(buildCacheKey('a', '', 'b')).not.toBe(buildCacheKey('a', 'b'));
    });

    it('keeps colons inside parts as-is', () => {
      expect(buildCacheKey('a:b', 'c')).toBe(buildCacheKey('a', 'b:c'));
    });

    it('returns an empty string without parts', () => {
      expect(buildCacheKey()).toBe('');
    });
  });
});
