import { Fixtures } from '../../../../test/fixtures';
import {
  RenovateConfig,
  getConfig,
  mockedFunction,
  partial,
} from '../../../../test/util';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import * as cache from '../../../util/cache/repository';
import type {
  BaseBranchCache,
  BranchCache,
  RepoCacheData,
} from '../../../util/cache/repository/types';
import {
  runBranchSummery,
  runRenovateRepoStats,
} from './repository-statistics';

jest.mock('../../../modules/platform/github/pr');
jest.mock('../../../util/http/github');

const prJson = Fixtures.getJson('./pr-list.json');
const result = Object.keys(prJson).map((key) => {
  return prJson[key];
});

describe('workers/repository/finalise/repository-statistics', () => {
  let config: RenovateConfig;

  describe('runRenovateRepoStats', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
      mockedFunction(platform.getPrList).mockReturnValue(prJson);
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

  describe('runBranchSummery', () => {
    const cacheSpy = jest.spyOn(cache, 'getCache');

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('processes cache with baseBranches only', () => {
      const sha = '793221454914cdc422e1a8f0ca27b96fe39ff9ad';
      const baseCache = partial<BaseBranchCache>({ sha });
      const cache = partial<RepoCacheData>({
        scan: { main: baseCache, dev: baseCache },
      });
      cacheSpy.mockReturnValueOnce(cache);
      runBranchSummery();
      expect(logger.debug).toHaveBeenCalledWith(
        {
          baseBranches: [
            {
              branchName: 'main',
              sha,
            },
            {
              branchName: 'dev',
              sha,
            },
          ],
          branches: [],
          inactiveBranches: [],
        },
        `Branch summary`
      );
    });

    it('processes cache with baseBranches and branches', () => {
      const sha = '793221454914cdc422e1a8f0ca27b96fe39ff9ad';
      const parentSha = '793221454914cdc422e1a8f0ca27b96fe39ff9ad';
      const baseCache = partial<BaseBranchCache>({ sha });
      const branchCache = partial<BranchCache>({
        sha,
        parentSha,
        isModified: false,
        automerge: false,
      });
      const branches: BranchCache[] = [
        { ...branchCache, branchName: 'b1' },
        {
          ...branchCache,
          branchName: 'b2',
        },
        partial<BranchCache>({ branchName: 'b3' }),
      ];
      const cache = partial<RepoCacheData>({
        scan: { main: baseCache, dev: baseCache },
        branches,
      });

      cacheSpy.mockReturnValueOnce(cache);
      runBranchSummery();
      expect(logger.debug).toHaveBeenCalledWith(
        {
          baseBranches: [
            {
              branchName: 'main',
              sha,
            },
            {
              branchName: 'dev',
              sha,
            },
          ],
          branches: [
            { ...branchCache, branchName: 'b1' },
            { ...branchCache, branchName: 'b2' },
          ],
          inactiveBranches: ['b3'],
        },
        `Branch summary`
      );
    });
  });
});
