import { defaultConfig, git, mocked } from '../../../../test/util';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getExtractList } from '../process/extract-update';
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
      git.getFileList.mockResolvedValue(fileList);
      config = { ...defaultConfig };
    });

    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const [extractList] = await getExtractList(config);
      const res = await extractAllDependencies(config, extractList);
      expect(Object.keys(res)).toContain('ansible');
    });

    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const [extractList] = await getExtractList(config);
      const res = await extractAllDependencies(config, extractList);
      expect(res).toEqual({ npm: [{}] });
    });

    it('warns if no packages found for a enabled manager', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([]);
      const [extractList] = await getExtractList(config);
      expect(await extractAllDependencies(config, extractList)).toEqual({});
      expect(logger.debug).toHaveBeenCalled();
    });

    it('warns if packageFiles is null', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue(null);
      const [extractList] = await getExtractList(config);
      expect(await extractAllDependencies(config, extractList)).toEqual({});
    });

    it('adds skipReason to internal deps when updateInternalDeps is false/undefined', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        {
          deps: [{ depName: 'a', isInternal: true }, { depName: 'b' }],
        },
      ]);
      const [extractList] = await getExtractList(config);
      expect(await extractAllDependencies(config, extractList)).toEqual({
        npm: [
          {
            deps: [
              {
                depName: 'a',
                isInternal: true,
                skipReason: 'internal-package',
              },
              { depName: 'b' },
            ],
          },
        ],
      });
      expect(logger.debug).toHaveBeenCalled();
    });

    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      config.regexManagers = [{ fileMatch: ['README'], matchStrings: [''] }];
      const [extractList] = await getExtractList(config);
      const res = await extractAllDependencies(config, extractList);
      expect(Object.keys(res)).toContain('regex');
    });
  });
});
