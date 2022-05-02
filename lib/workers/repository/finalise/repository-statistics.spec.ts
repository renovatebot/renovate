import {
  RenovateConfig,
  getConfig,
  loadJsonFixture,
  mockedFunction,
} from '../../../../test/util';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { runRenovateRepoStats } from './repository-statistics';

jest.mock('../../../modules/platform/github/pr');
jest.mock('../../../util/http/github');

const prList = loadJsonFixture('./pr-list.json');
const result = Object.keys(prList).map((key) => {
  return prList[key];
});

describe('workers/repository/finalise/repository-statistics', () => {
  let config: RenovateConfig;

  describe('runRenovateRepoStats', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      mockedFunction(platform.getPrList).mockReturnValue(prList);
      config.repository = 'owner/repo';
    });

    it('Calls runRenovateRepoStats', async () => {
      await runRenovateRepoStats(config, result);
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
