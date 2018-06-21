const { parse } = require('../../lib/util/purl');

describe('util/purl', () => {
  describe('parse()', () => {
    it('returns null for null', () => {
      expect(parse(null)).toBe(null);
    });
    it('returns null if not pkg', () => {
      expect(parse('foo:bar')).toBe(null);
    });
    it('parses simple npm', () => {
      expect(parse('pkg:npm/foo')).toMatchSnapshot();
    });
    it('parses namespaced npm', () => {
      expect(parse('pkg:npm/%40foo/bar')).toMatchSnapshot();
    });
    it('parses namespaced npm with version', () => {
      expect(parse('pkg:npm/%40foo/bar@1.0.0')).toMatchSnapshot();
    });
    it('parses npm with version and 1 qualifier', () => {
      expect(parse('pkg:npm/foo@1.0.0?a=b')).toMatchSnapshot();
    });
    it('parses npm with version and 2 qualifiers', () => {
      expect(parse('pkg:npm/foo@1.0.0?a=b&c=d')).toMatchSnapshot();
    });
    it('parses npm with version and 2 qualifiers and subpath', () => {
      expect(parse('pkg:npm/foo@1.0.0?a=b&c=d#stop')).toMatchSnapshot();
    });
  });
});
