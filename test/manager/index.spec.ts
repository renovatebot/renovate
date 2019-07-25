import * as manager from '../../lib/manager';

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
      expect(
        manager.extractAllPackageFiles('dockerfile', {} as any, [])
      ).toBeNull();
    });
    it('returns non-null', () => {
      expect(
        manager.extractAllPackageFiles('npm', {} as any, [])
      ).not.toBeNull();
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null', () => {
      expect(manager.extractPackageFile('unknown', null)).toBeNull();
    });
  });

  describe('getPackageUpdates', () => {
    it('returns null', () => {
      expect(manager.getPackageUpdates('unknown', null)).toBeNull();
    });
  });
});
