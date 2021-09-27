import { defaultConfig, git, mocked } from '../../../../test/util';
import type { RenovateConfig } from '../../../config/types';
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
      const res = await extractAllDependencies(config);
      expect(Object.keys(res)).toContain('ansible');
    });
    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });

    it('warns if no package files found for a enabled manager', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      await expect(extractAllDependencies(config)).resolves.not.toThrow();
    });

    it('warns if zero packages found for a enabled manager', async () => {
      config.enabledManagers = ['composer'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([
        { composer: { packageFile: 'composer.json', deps: [] } },
      ] as never);
      await expect(extractAllDependencies(config)).resolves.not.toThrow();
    });

    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      config.regexManagers = [{ fileMatch: ['README'], matchStrings: [''] }];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res)).toContain('regex');
    });
  });
});
