import { join } from 'upath';
import { loadModules } from '../../util/modules';
import { getDatasourceList } from '../datasource';
import { getCustomManagerList } from './custom';
import type { ManagerApi } from './types';
import * as manager from '.';
import * as customManager from './custom';

jest.mock('../../util/fs');

const datasources = getDatasourceList();

describe('modules/manager/index', () => {
  describe('supportedDatasources', () => {
    for (const m of manager.getManagerList()) {
      if (m === 'custom') {
        // custom managers support any
        continue;
      }
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
      expect(manager.get('dockerfile', 'extractPackageFile')).not.toBeNull();
      expect(manager.get('custom.regex', 'extractPackageFile')).not.toBeNull();
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
    const customMgrs = customManager.getCustomManagers();

    const loadedMgr = loadModules(__dirname, validate);
    const loadedCustomMgr = loadModules(join(__dirname, 'custom'), validate);

    expect(Array.from([...mgrs.keys(), ...customMgrs.keys()])).toEqual(
      Object.keys({ ...loadedMgr, ...loadedCustomMgr })
    );

    for (const name of mgrs.keys()) {
      const mgr = mgrs.get(name)!;
      expect(validate(mgr)).toBeTrue();
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
        await manager.extractAllPackageFiles('unknown', {} as any, [])
      ).toBeNull();
      expect(
        await manager.extractAllPackageFiles('dummy', {} as any, [])
      ).toBeNull();
    });

    it('returns non-null', async () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
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
        supportedDatasources: [],
      });
      expect(
        manager.extractPackageFile('unknown', '', 'filename', {})
      ).toBeNull();
      expect(
        manager.extractPackageFile('dummy', '', 'filename', {})
      ).toBeNull();
    });

    it('handles custom managers', () => {
      customManager.getCustomManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        extractPackageFile: () => Promise.resolve({ deps: [] }),
      });
      expect(
        manager.extractPackageFile('custom.dummy', '', 'filename', {})
      ).not.toBeNull();
    });

    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        extractPackageFile: () => Promise.resolve({ deps: [] }),
      });

      expect(
        manager.extractPackageFile('dummy', '', 'filename', {})
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
        manager.getRangeStrategy({ manager: 'unknown', rangeStrategy: 'auto' })
      ).toBeNull();
    });

    it('returns non-null', () => {
      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
        getRangeStrategy: () => 'replace',
      });
      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'auto' })
      ).not.toBeNull();

      manager.getManagers().set('dummy', {
        defaultConfig: {},
        supportedDatasources: [],
      });
      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'auto' })
      ).not.toBeNull();

      expect(
        manager.getRangeStrategy({ manager: 'dummy', rangeStrategy: 'bump' })
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
        })
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
        })
      ).toBe('update-lockfile');
    });

    afterEach(() => {
      manager.getManagers().delete('dummy');
    });
  });
});
