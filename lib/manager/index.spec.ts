import * as manager from '.';
import { ManagerApi } from './common';
import { loadModules } from '../util/modules';

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

  it('validates', () => {
    function validate(module: ManagerApi): boolean {
      if (!module.defaultConfig) {
        return false;
      }
      if (!module.updateDependency && !module.autoReplace) {
        return false;
      }
      if (!module.extractPackageFile && !module.extractAllPackageFiles) {
        return false;
      }
      return true;
    }
    const mgrs = manager.getManagers();

    const loadedMgr = loadModules(__dirname, validate);
    expect(Array.from(mgrs.keys())).toEqual(Object.keys(loadedMgr));

    for (const name of mgrs.keys()) {
      const mgr = mgrs.get(name);
      expect(validate(mgr)).toBe(true);
    }
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
