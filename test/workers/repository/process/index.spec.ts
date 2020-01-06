import { processRepo } from '../../../../lib/workers/repository/process/index';
import * as _extractUpdate from '../../../../lib/workers/repository/process/extract-update';
import { mocked } from '../../../util';

jest.mock('../../../../lib/workers/repository/process/extract-update');

const extractAndUpdate = mocked(_extractUpdate).extractAndUpdate;

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../config/config/_fixtures');
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
