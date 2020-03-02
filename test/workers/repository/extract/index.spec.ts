import * as _managerFiles from '../../../../lib/workers/repository/extract/manager-files';
import { extractAllDependencies } from '../../../../lib/workers/repository/extract';
import { mocked, defaultConfig } from '../../../util';
import { RenovateConfig } from '../../../../lib/config';

jest.mock('../../../../lib/workers/repository/extract/manager-files');

const managerFiles = mocked(_managerFiles);

describe('workers/repository/extract/index', () => {
  describe('extractAllDependencies()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = { ...defaultConfig };
    });
    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(Object.keys(res).includes('ansible')).toBe(true);
    });
    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      config.customManagers = [{ matchStrings: [''] }];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res).includes('custom')).toBe(true);
    });
  });
});
