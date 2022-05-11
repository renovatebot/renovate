import { Fixtures } from '../../../../test/fixtures';
import {
  RenovateConfig,
  getConfig,
  mockedFunction,
} from '../../../../test/util';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { runRenovateRepoStats } from './repository-statistics';

jest.mock('../../../modules/platform/github/pr');
jest.mock('../../../util/http/github');

const prJson = Fixtures.get('./pr-list.json');
const prObject = JSON.parse(prJson);
const result = Object.keys(prObject).map((key) => {
  return prObject[key];
});

describe('workers/repository/finalise/repository-statistics', () => {
  let config: RenovateConfig;

  describe('runRenovateRepoStats', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      mockedFunction(platform.getPrList).mockReturnValue(prObject);
      config.repository = 'owner/repo';
    });

    it('Calls runRenovateRepoStats', () => {
      runRenovateRepoStats(config, result);
      expect(logger.debug).toHaveBeenCalledWith(
        {
          stats: {
            total: 4,
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
