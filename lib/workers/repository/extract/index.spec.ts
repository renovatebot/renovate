import { mocked, partial, scm } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import * as _managerFiles from './manager-files';
import { extractAllDependencies } from '.';

jest.mock('./manager-files');
jest.mock('../../../util/git');

const managerFiles = mocked(_managerFiles);

describe('workers/repository/extract/index', () => {
  describe('extractAllDependencies()', () => {
    let config: RenovateConfig;
    const fileList = ['README', 'package.json', 'tasks/ansible.yaml'];

    beforeEach(() => {
      jest.resetAllMocks();
      scm.getFileList.mockResolvedValue(fileList);
      config = getConfig();
    });

    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        partial<PackageFile<Record<string, any>>>({}),
      ]);
      delete config.regexManagers; // for coverage
      const res = await extractAllDependencies(config);
      expect(Object.keys(res.packageFiles)).toContain('ansible');
    });

    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm', 'custom'];
      config.regexManagers = [{ fileMatch: ['README'], matchStrings: [''] }];
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        partial<PackageFile<Record<string, any>>>({}),
      ]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchObject({
        packageFiles: { npm: [{}], 'custom.regex': [{}] },
      });
    });

    it('warns if no packages found for enabled managers', async () => {
      config.enabledManagers = ['npm', 'custom.regex'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([]);
      expect((await extractAllDependencies(config)).packageFiles).toEqual({});
      expect(logger.warn).toHaveBeenCalledTimes(2);
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
      config.regexManagers = [{ fileMatch: ['README'], matchStrings: [''] }];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res.packageFiles)).toContain('custom.regex');
    });
  });
});
