import {
  RenovateConfig,
  getConfig,
  git,
  platform,
} from '../../../../test/util';
import { checkBaseBranch } from './base';

jest.mock('../../../util/git');

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
      git.branchExists.mockResolvedValue(true);
      const res = await checkBaseBranch(config);
      expect(res.errors).toHaveLength(0);
      expect(platform.setBaseBranch).toHaveBeenCalledTimes(1);
    });
  });
});
