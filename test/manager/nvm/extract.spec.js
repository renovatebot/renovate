const { extractDependencies } = require('../../../lib/manager/nvm/extract');

describe('lib/manager/nvm/extract', () => {
  describe('extractDependencies()', () => {
    it('returns a result', () => {
      const res = extractDependencies('8.4.0\n');
      expect(res).toMatchSnapshot();
    });
  });
});
