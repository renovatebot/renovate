const { extractDependencies } = require('../../../lib/manager/travis/extract');

describe('lib/manager/travis/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to parse', () => {
      const res = extractDependencies('blahhhhh:foo:@what\n', config);
      expect(res).toBe(null);
    });
    it('returns results', () => {
      const res = extractDependencies('node_js:\n  - 6\n  - 8\n', config);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
  });
});
