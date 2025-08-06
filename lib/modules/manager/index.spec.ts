import upath from 'upath';
import { loadModules } from '../../util/modules';
import { getDatasourceList } from '../datasource';
import * as customManager from './custom';
import type { ManagerApi } from './types';
import * as manager from '.';

vi.mock('../../util/fs');

const datasources = getDatasourceList();

describe('modules/manager/index', () => {
  describe('supportedDatasources', () => {
    // no need to check custom managers as they support all datasources
    for (const m of manager.getManagerList()) {
      const supportedDatasources = manager.get(m, 'supportedDatasources');

      it(`has valid supportedDatasources for ${m}`, () => {
        expect(supportedDatasources).toBeNonEmptyArray();
        supportedDatasources!.every((d) => {
          expect(datasources.includes(d)).toBeTrue();
        });
      });
    }
  });

  describe('get()', () => {
    it('gets something', () => {
      expect(manager.get('dockerfile', 'extractPackageFile')).not.toBeNull(); // gets built-in manager
      expect(manager.get('regex', 'extractPackageFile')).not.toBeNull(); // gets custom manager
    });
  });

  describe('getManagerList()', () => {
    it('gets', () => {
      expect(manager.getManagerList()).not.toBeNull();
    });
  });

  describe('getEnabledManagersList()', () => {
    it('works', () => {
      expect(manager.getEnabledManagersList()).toEqual(manager.allManagersList);
      expect(manager.getEnabledManagersList(['custom.regex', 'npm'])).toEqual([
        'npm',
        'regex',
      ]);
    });
  });

  it('validates', async () => {
    function validate(module: ManagerApi, moduleName: string): boolean {
      // no need to validate custom as it is a wrapper and not an actual manager
      if (moduleName === 'custom') {
        return true;
      }
      if (!module.defaultConfig) {
        return false;
      }
      if (!module.extractPackageFile && !module.extractAllPackageFiles) {
        return false;
      }
      // managers must export either extractPackageFile or a custom updateDependency function in addition to extractAllPackageFiles
      if (
        module.extractAllPackageFiles &&
        !module.extractPackageFile &&
        !module.updateDependency
      ) {
        return false;
      }
      if (Object.values(module).some((v) => v === undefined)) {
        return false;
      }
      return true;
    }
    const mgrs = manager.getManagers();
    const customMgrs = customManager.getCustomManagers();

    const loadedMgr = {
      ...(await loadModules(__dirname, validate)), // validate built-in managers
      ...(await loadModules(upath.join(__dirname, 'custom'), validate)), // validate custom managers
    };
    delete loadedMgr.custom;

    expect(Array.from([...mgrs.keys(), ...customMgrs.keys()]).sort()).toEqual(
      Object.keys(loadedMgr).sort(),
    );

    for (const name of mgrs.keys()) {
      const mgr = mgrs.get(name)!;
      expect(validate(mgr, name)).toBeTrue();
    }
  });

  describe('detectGlobalConfig()', () => {
    it('iterates through managers', async () => {
      expect(await manager.detectAllGlobalConfig()).toEqual({});
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('returns null', async () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
      });
      expect(
        await manager.extractAllPackageFiles('unknown', {} as any, []),
      ).toBeNull();
      expect(
        await manager.extractAllPackageFiles('dummy', {} as any, []),
      ).toBeNull();
    });

    it('returns non-null', async () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        extractAllPackageFiles: () => Promise.resolve([]),
      });
      expect(
        await manager.extractAllPackageFiles('dummy', {} as any, []),
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
        supportedDatasources: [],
      });
      expect(
        manager.extractPackageFile('unknown', '', 'filename', {}),
      ).toBeNull();
      expect(
        manager.extractPackageFile('dummy', '', 'filename', {}),
      ).toBeNull();
    });

    it('handles custom managers', () => {
      customManager.getCustomManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        extractPackageFile: () => Promise.resolve({ deps: [] }),
      });
      expect(
        manager.extractPackageFile('dummy', '', 'filename', {}),
      ).not.toBeNull();
    });

    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        extractPackageFile: () => Promise.resolve({ deps: [] }),
      });

      expect(
        manager.extractPackageFile('dummy', '', 'filename', {}),
      ).not.toBeNull();
    });

    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });

  describe('getRangeStrategy', () => {
    it('returns null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
      });
      expect(
        manager.getRangeStrategy({ manager: 'unknown', rangeStrategy: 'auto' }),
      ).toBeNull();
    });

    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        getRangeStrategy: () => 'replace',
      });
      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'auto' }),
      ).not.toBeNull();

      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
      });
      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'auto' }),
      ).not.toBeNull();

      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'bump' }),
      ).not.toBeNull();
    });

    it('returns update-lockfile for in-range-only', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
      });
      expect(
        manager.getRangeStrategy({
          manager: 'dummy',
          rangeStrategy: 'in-range-only',
        }),
      ).toBe('update-lockfile');
    });

    it('returns update-lockfile for in-range-only if it is proposed my manager', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        getRangeStrategy: () => 'in-range-only',
      });
      expect(
        manager.getRangeStrategy({
          manager: 'dummy',
          rangeStrategy: 'in-range-only',
        }),
      ).toBe('update-lockfile');
    });

    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });

  describe('isKnownManager', () => {
    it('returns true', () => {
      expect(manager.isKnownManager('npm')).toBeTrue();
      expect(manager.isKnownManager('regex')).toBeTrue();
      expect(manager.isKnownManager('custom.regex')).toBeTrue();
    });

    it('returns false', () => {
      expect(manager.isKnownManager('npm-unkown')).toBeFalse();
      expect(manager.isKnownManager('custom.unknown')).toBeFalse();
    });
  });
});
