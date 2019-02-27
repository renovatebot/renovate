const { extractPackageFile } = require('../../../lib/manager/nvm/extract');

describe('lib/manager/nvm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('8.4.0\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non-pinned', () => {
      const res = extractPackageFile('8.4\n');
      expect(res.deps).toMatchSnapshot();
    });
  });
});
