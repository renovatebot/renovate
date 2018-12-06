const { extractPackageFile } = require('../../../lib/manager/bundler/extract');

describe('lib/manager/bundler/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBeNull();
    });
  });
});
