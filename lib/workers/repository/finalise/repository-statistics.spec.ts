import {
  RenovateConfig,
  getConfig,
  loadJsonFixture,
  mockedFunction,
} from '../../../../test/util';
import { logger } from '../../../logger';
import { getPrCache } from '../../../modules/platform/github/pr';
import { runRenovateRepoStats } from './repository-statistics';

jest.mock('../../../modules/platform/github/pr');
jest.mock('../../../util/http/github');

const prCache = loadJsonFixture('./pr-cache.json');

describe('workers/repository/finalise/repository-statistics', () => {
  let config: RenovateConfig;

  describe('runRenovateRepoStats', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      mockedFunction(getPrCache).mockReturnValue(prCache);
      config.repository = 'owner/repo';
    });

    it('Calls runRenovateRepoStats', async () => {
      await runRenovateRepoStats(config);
      expect(logger.debug).toHaveBeenCalledWith(
        {
          stats: {
            total: 3,
            open: 1,
            closed: 1,
            merged: 1,
          },
        },
        `Renovate repository PR statistics`
      );
    });
  });
});
