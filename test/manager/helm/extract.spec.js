const { extractPackageFile } = require('../../../lib/manager/helm/extract');

describe('lib/manager/helm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty array', () => {
      const content = 'some_content';
      expect(extractPackageFile(content)).toBe([]);
    });
  });
});
