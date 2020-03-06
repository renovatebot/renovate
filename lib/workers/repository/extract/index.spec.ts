import * as _managerFiles from './manager-files';
import { extractAllDependencies } from '.';
import { mocked, defaultConfig } from '../../../../test/util';
import { RenovateConfig } from '../../../config';

jest.mock('./manager-files');

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
    it('skips non-enabled maangers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
  });
});
