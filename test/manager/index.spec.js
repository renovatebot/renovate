const manager = require('../../lib/manager');

describe('manager', () => {
  describe('get()', () => {
    it('gets something', () => {
      expect(manager.get('docker', 'extractDependencies')).not.toBe(null);
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
  describe('postExtract()', () => {
    it('returns null', () => {
      expect(manager.postExtract('docker', [])).toBe(null);
    });
    it('returns postExtract', () => {
      expect(manager.postExtract('npm', [])).not.toBe(null);
    });
  });
});
