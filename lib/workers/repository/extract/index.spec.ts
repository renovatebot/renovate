import { defaultConfig, git, mocked } from '../../../../test/util';
import { RenovateConfig } from '../../../config';
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
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies({
        ...config,
        ansible: { enabled: false },
      });
      expect(res).toMatchSnapshot();
    });
    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      config.regexManagers = [{ fileMatch: ['README'], matchStrings: [''] }];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res)).toContain('regex');
    });
  });
});
