import { checkBaseBranch } from '../../../../lib/workers/repository/init/base';
import { platform, getConfig, RenovateConfig } from '../../../util';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...getConfig() };
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/init/base', () => {
  describe('checkBaseBranch()', () => {
    it('errors', async () => {
      config.baseBranch = 'some-base';
      const res = await checkBaseBranch(config);
      expect(res.errors).toHaveLength(1);
    });
    it('sets baseBranch', async () => {
      config.baseBranch = 'ssome-base';
      platform.branchExists.mockResolvedValue(true);
      const res = await checkBaseBranch(config);
      expect(res.errors).toHaveLength(0);
      expect(platform.setBaseBranch).toHaveBeenCalledTimes(1);
    });
  });
});
