import { getCombinedKey } from './key';

describe('util/cache/package/key', () => {
  describe('getCombinedKey', () => {
    it('works', () => {
      expect(getCombinedKey('datasource-github-releases', 'foo:bar')).toBe(
        'global%%datasource-github-releases%%foo:bar',
      );
    });
  });
});
