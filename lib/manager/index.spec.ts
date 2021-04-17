import { getName } from '../../test/util';
import { loadModules } from '../util/modules';
import type { ManagerApi } from './types';
import * as manager from '.';

describe(getName(__filename), () => {
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
      if (!module.extractPackageFile && !module.extractAllPackageFiles) {
        return false;
      }
      if (Object.values(module).some((v) => v === undefined)) {
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
    it('returns null', async () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
      });
      expect(
        await manager.extractAllPackageFiles('unknown', {} as any, [])
      ).toBeNull();
      expect(
        await manager.extractAllPackageFiles('dummy', {} as any, [])
      ).toBeNull();
    });
    it('returns non-null', async () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        extractAllPackageFiles: () => Promise.resolve([]),
      });
      expect(
        await manager.extractAllPackageFiles('dummy', {} as any, [])
      ).not.toBeNull();
    });
    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
      });
      expect(manager.extractPackageFile('unknown', null)).toBeNull();
      expect(manager.extractPackageFile('dummy', null)).toBeNull();
    });
    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        extractPackageFile: () => Promise.resolve({ deps: [] }),
      });

      expect(manager.extractPackageFile('dummy', null)).not.toBeNull();
    });
    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });

  describe('getPackageUpdates', () => {
    it('returns null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
      });
      expect(manager.getPackageUpdates('unknown', null)).toBeNull();
      expect(manager.getPackageUpdates('dummy', null)).toBeNull();
    });
    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        getPackageUpdates: () => Promise.resolve({ updates: [] }),
      });
      expect(manager.getPackageUpdates('dummy', {} as any)).not.toBeNull();
    });
    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });

  describe('getRangeStrategy', () => {
    it('returns null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
      });
      expect(
        manager.getRangeStrategy({ manager: 'unknown', rangeStrategy: 'auto' })
      ).toBeNull();
    });
    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        getRangeStrategy: () => 'replace',
      });
      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'auto' })
      ).not.toBeNull();

      manager.getManagers().set('dummy', {
        defaultConfig: {},
      });
      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'auto' })
      ).not.toBeNull();

      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'bump' })
      ).not.toBeNull();
    });
    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });
});
