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
  });
});
