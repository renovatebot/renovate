const manager = require('../../lib/manager');

describe('manager', () => {
  describe('get()', () => {
    it('gets something', () => {
      expect(manager.get('dockerfile', 'extractPackageFile')).not.toBe(null);
    });
  });
  describe('getLanguageList()', () => {
    it('gets', () => {
      expect(manager.getLanguageList()).not.toBe(null);
    });
  });
  describe('getManagerList()', () => {
    it('gets', () => {
      expect(manager.getManagerList()).not.toBe(null);
    });
  });
  describe('extractAllPackageFiles()', () => {
    it('returns null', () => {
      expect(manager.extractAllPackageFiles('dockerfile', [])).toBe(null);
    });
    it('returns non-null', () => {
      expect(manager.extractAllPackageFiles('npm', [])).not.toBe(null);
    });
  });
});
