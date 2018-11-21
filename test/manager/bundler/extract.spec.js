const {
  extractPackageFile,
} = require('../../../lib/manager/newmanager/extract');

describe('lib/manager/newmanager/extract', () => {
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
