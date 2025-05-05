import { getCombinedKey } from './key';

describe('util/cache/package/key', () => {
  describe('getCombinedKey', () => {
    it('works', () => {
      expect(getCombinedKey('_test-namespace', 'foo:bar')).toBe(
        'datasource-mem-cache:package-cache-memoization:_test-namespace:foo:bar',
      );
    });
  });
});
