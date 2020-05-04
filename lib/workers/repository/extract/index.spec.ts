import { defaultConfig, mocked, platform } from '../../../../test/util';
import { RenovateConfig } from '../../../config';
import * as _cache from './cache';
import * as _managerFiles from './manager-files';
import { extractAllDependencies } from '.';

jest.mock('./cache');
jest.mock('./manager-files');

const cache = mocked(_cache);
const managerFiles = mocked(_managerFiles);

describe('workers/repository/extract/index', () => {
  describe('extractAllDependencies()', () => {
    let config: RenovateConfig;
    const fileList = ['README', 'package.json', 'tasks/ansible.yaml'];
    beforeEach(() => {
      jest.resetAllMocks();
      platform.getFileList.mockResolvedValue(fileList);
      config = { ...defaultConfig };
    });
    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(Object.keys(res).includes('ansible')).toBe(true);
    });
    it('uses cache', async () => {
      cache.getCachedExtract.mockResolvedValueOnce({} as never);
      const res = await extractAllDependencies(config);
      expect(res).toEqual({});
    });
    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      config.regexManagers = [{ fileMatch: ['README'], matchStrings: [''] }];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res).includes('regex')).toBe(true);
    });
  });
});
