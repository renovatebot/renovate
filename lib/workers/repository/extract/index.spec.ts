import { mockDeep} from "jest-mock-extended";
import { mocked, partial, scm } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as managers from '../../../modules/manager'
import type {ManagerApi, PackageFile} from '../../../modules/manager/types';
import * as _managerFiles from './manager-files';
import {applyPreFlights, extractAllDependencies} from '.';

jest.mock('./manager-files');
jest.mock('../../../util/git');

const managerFiles = mocked(_managerFiles);


describe('workers/repository/extract/index', () => {
  describe('extractAllDependencies()', () => {
    let config: RenovateConfig;
    const fileList = ['README', 'package.json', 'tasks/ansible.yaml'];

    beforeEach(() => {
      scm.getFileList.mockResolvedValue(fileList);
      config = getConfig();
    });

    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        partial<PackageFile<Record<string, any>>>({}),
      ]);
      delete config.customManagers; // for coverage
      const res = await extractAllDependencies(config);
      expect(Object.keys(res.packageFiles)).toContain('ansible');
    });

    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        partial<PackageFile<Record<string, any>>>({}),
      ]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchObject({
        packageFiles: { npm: [{}] },
      });
    });

    it('warns if no packages found for a enabled manager', async () => {
      config.enabledManagers = ['npm', 'custom.regex'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([]);
      expect((await extractAllDependencies(config)).packageFiles).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith(
        { manager: 'custom.regex' },
        `Manager explicitly enabled in "enabledManagers" config, but found no results. Possible config error?`,
      );
    });

    it('warns if packageFiles is null', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue(null);
      expect((await extractAllDependencies(config)).packageFiles).toEqual({});
    });

    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        partial<PackageFile<Record<string, any>>>({}),
      ]);
      config.customManagers = [
        { customType: 'regex', fileMatch: ['README'], matchStrings: [''] },
      ];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res.packageFiles)).toContain('regex');
    });
  });

  describe('applyPreFlights()', () => {
    const mockedManager = mockDeep<ManagerApi>()
    const getFunction = jest.spyOn(managers, 'get')
    getFunction.mockImplementation((manager, name) => mockedManager[name])
    const baseConfig: RenovateConfig = {
      foo: "bar"
    }

    it('should return same config for unknown manager', () => {
      expect(applyPreFlights(baseConfig,["test"])).toEqual({
        foo: "bar"
      })
    });

    it('should return modified config for manager', () => {
      mockedManager.preflight = (config: RenovateConfig) => {
        return {
          ...config,
          foo: "foo"
        }
      }

      expect(applyPreFlights(baseConfig,["test"])).toEqual({
        foo: "foo"
      })
    });
  })
});
