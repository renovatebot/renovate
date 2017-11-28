const { extractDependencies } = require('../../../lib/manager/node/extract');

describe('lib/manager/node/extract', () => {
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
