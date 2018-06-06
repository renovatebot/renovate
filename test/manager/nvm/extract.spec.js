const { extractDependencies } = require('../../../lib/manager/nvm/extract');

describe('lib/manager/nvm/extract', () => {
  describe('extractDependencies()', () => {
    it('returns a result', () => {
      const res = extractDependencies('8.4.0\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non-pinned', () => {
      const res = extractDependencies('8.4\n');
      expect(res.deps).toMatchSnapshot();
    });
  });
});
