import { processRepo } from './index';
import * as _extractUpdate from './extract-update';
import { getConfig, mocked, RenovateConfig } from '../../../../test/util';

jest.mock('./extract-update');

const extractAndUpdate = mocked(_extractUpdate).extractAndUpdate;

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
      extractAndUpdate.mockResolvedValue({} as never);
      config.baseBranches = ['branch1', 'branch2'];
      const res = await processRepo(config);
      expect(res).toMatchSnapshot();
    });
  });
});
