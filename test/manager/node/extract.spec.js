const { extractDependencies } = require('../../../lib/manager/travis/extract');

describe('lib/manager/travis/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to pass', () => {
      const res = extractDependencies('blahhhhh:foo:@what\n', config);
      expect(res).toEqual([]);
    });
  });
});
