const { extractPackageFile } = require('../../../lib/manager/travis/extract');

describe('lib/manager/travis/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n', config);
      expect(res).toBe(null);
    });
    it('returns results', () => {
      const res = extractPackageFile('node_js:\n  - 6\n  - 8\n', config);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
  });
});
