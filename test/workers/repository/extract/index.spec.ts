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
      expect(res).toMatchSnapshot();
    });
    it('skips non-enabled maangers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
  });
});
