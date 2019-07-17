const { extractPackageFile } = require('../../../lib/manager/travis/extract');

describe('lib/manager/travis/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });
    it('returns results', () => {
      const res = extractPackageFile('node_js:\n  - 6\n  - 8\n');
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
  });
});
