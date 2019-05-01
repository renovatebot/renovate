const manager = require('../../lib/manager');

describe('manager', () => {
  describe('get()', () => {
    it('gets something', () => {
      expect(manager.get('dockerfile', 'extractPackageFile')).not.toBeNull();
    });
  });
  describe('getLanguageList()', () => {
    it('gets', () => {
      expect(manager.getLanguageList()).not.toBeNull();
    });
  });
  describe('getManagerList()', () => {
    it('gets', () => {
      expect(manager.getManagerList()).not.toBeNull();
    });
  });
  describe('extractAllPackageFiles()', () => {
    it('returns null', () => {
      expect(manager.extractAllPackageFiles('dockerfile', [])).toBeNull();
    });
    it('returns non-null', () => {
      expect(manager.extractAllPackageFiles('npm', {}, [])).not.toBeNull();
    });
  });
});
