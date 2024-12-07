import { mocked, partial, scm } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as managers from '../../../modules/manager';
import type { PackageFile } from '../../../modules/manager/types';
import * as _managerFiles from './manager-files';
import { applyPreFlights, extractAllDependencies } from '.';

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
    const getFunction = jest.spyOn(managers, 'get');
    const baseConfig: RenovateConfig = {
      foo: 'bar',
    };

    it('should return same config for unknown manager', async () => {
      await expect(applyPreFlights(baseConfig, ['test'])).resolves.toEqual({
        foo: 'bar',
      });
    });

    it('should return modified config for manager', async () => {
      getFunction.mockReturnValueOnce((config: RenovateConfig) => {
        return {
          ...config,
          foo: 'foo',
        };
      });

      await expect(applyPreFlights(baseConfig, ['test'])).resolves.toEqual({
        foo: 'foo',
      });
    });

    it('should return modified config for multiple managers', async () => {
      getFunction.mockReturnValueOnce((config: RenovateConfig) => {
        return {
          ...config,
          foo: 'foo',
        };
      });
      getFunction.mockReturnValueOnce((config: RenovateConfig) => {
        return {
          ...config,
          lip: 'sum',
          foo: 'bar',
        };
      });

      await expect(
        applyPreFlights(baseConfig, ['test', 'another-manager']),
      ).resolves.toEqual({
        foo: 'bar',
        lip: 'sum',
      });
    });

    it('should return modified config for async preflights managers', async () => {
      getFunction.mockReturnValueOnce((config: RenovateConfig) => {
        return {
          ...config,
          foo: 'foo',
        };
      });
      getFunction.mockReturnValueOnce((config: RenovateConfig) => {
        return Promise.resolve({
          ...config,
          lip: 'sum',
          foo: 'bar',
        });
      });

      await expect(
        applyPreFlights(baseConfig, ['test', 'another-manager']),
      ).resolves.toEqual({
        foo: 'bar',
        lip: 'sum',
      });
    });
  });
});
