import { RenovateConfig, getConfig, mocked } from '../../../../test/util';
import * as _extractUpdate from './extract-update';
import { processRepo, updateRepo } from './index';

jest.mock('./extract-update');

const extract = mocked(_extractUpdate).extract;

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await processRepo(config);
      expect(res).toMatchSnapshot();
    });
    it('processes baseBranches', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['branch1', 'branch2'];
      const res = await processRepo(config);
      await updateRepo(config, res.branches, res.branchList);
      expect(res).toMatchSnapshot();
    });
  });
});
