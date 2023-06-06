import { getConfig, mocked, partial, scm } from '../../../../test/util';
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
      const res = await extractAllDependencies(config);
      expect(Object.keys(res.packageFiles)).toContain('ansible');
    });

    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        partial<PackageFile<Record<string, any>>>({}),
      ]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchObject({ packageFiles: { npm: [{}] } });
    });

    it('warns if no packages found for a enabled manager', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([]);
      expect((await extractAllDependencies(config)).packageFiles).toEqual({});
      expect(logger.debug).toHaveBeenCalled();
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
      expect(Object.keys(res.packageFiles)).toContain('regex');
    });
  });
});
