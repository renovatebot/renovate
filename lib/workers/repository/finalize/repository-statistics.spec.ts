import { Fixtures } from '../../../../test/fixtures';
import { RenovateConfig, mockedFunction, partial } from '../../../../test/util';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import * as cache from '../../../util/cache/repository';
import type {
  BaseBranchCache,
  BranchCache,
  BranchUpgradeCache,
  RepoCacheData,
} from '../../../util/cache/repository/types';
import {
  runBranchSummary,
  runRenovateRepoStats,
} from './repository-statistics';

jest.mock('../../../modules/platform/github/pr');
jest.mock('../../../util/http/github');

const prJson = Fixtures.getJson('./pr-list.json');
const result = Object.keys(prJson).map((key) => {
  return prJson[key];
});

describe('workers/repository/finalize/repository-statistics', () => {
  let config: RenovateConfig;

  describe('runRenovateRepoStats', () => {
    beforeEach(() => {
      mockedFunction(platform.getPrList).mockReturnValue(prJson);
      config = partial<RenovateConfig>({
        onboardingPrTitle: 'Configure Renovate',
        defaultBranch: 'main',
        repository: 'owner/repo',
      });
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
        `Renovate repository PR statistics`,
      );
    });
  });

  describe('runBranchSummary', () => {
    const getCacheSpy = jest.spyOn(cache, 'getCache');
    const isCacheModifiedSpy = jest.spyOn(cache, 'isCacheModified');
    const config: RenovateConfig = {};

    it('processes cache with baseBranches only', () => {
      const sha = '793221454914cdc422e1a8f0ca27b96fe39ff9ad';
      const baseCache = partial<BaseBranchCache>({ sha });
      const cache = partial<RepoCacheData>({
        scan: { main: baseCache, dev: baseCache },
      });
      getCacheSpy.mockReturnValueOnce(cache);
      isCacheModifiedSpy.mockReturnValueOnce(true);

      runBranchSummary(config);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          cacheModified: true,
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
        `Branch summary`,
      );
    });

    it('processes cache with baseBranches and branches', () => {
      const sha = '793221454914cdc422e1a8f0ca27b96fe39ff9ad';
      const baseBranchSha = '793221454914cdc422e1a8f0ca27b96fe39ff9ad';
      const baseBranch = 'base-branch';
      const defaultBranch = 'main';
      const config: RenovateConfig = { defaultBranch };
      const baseCache = partial<BaseBranchCache>({ sha });
      const branchCache = partial<BranchCache>({
        sha,
        baseBranch,
        baseBranchSha,
        isModified: false,
        automerge: false,
        pristine: false,
        upgrades: [],
      });
      const expectedMeta = {
        automerge: branchCache.automerge,
        baseBranch,
        baseBranchSha,
        branchSha: sha,
        isModified: branchCache.isModified,
        isPristine: branchCache.pristine,
      };
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
      getCacheSpy.mockReturnValueOnce(cache);
      isCacheModifiedSpy.mockReturnValueOnce(false);

      runBranchSummary(config);

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
            { ...expectedMeta, branchName: 'b1' },
            { ...expectedMeta, branchName: 'b2' },
          ],
          cacheModified: false,
          defaultBranch,
          inactiveBranches: ['b3'],
        },
        `Branch summary`,
      );
    });

    it('logs extended branch info if branchSummaryExtended', () => {
      const defaultBranch = 'main';
      const config: RenovateConfig = {
        defaultBranch,
        branchSummaryExtended: true,
      };
      const branchCache = partial<BranchCache>({
        result: 'done',
        upgrades: partial<BranchUpgradeCache[]>([
          {
            datasource: 'npm',
            depName: 'minimist',
            currentValue: '1.2.3',
            sourceUrl: 'someUrl',
            depType: 'dependencies',
          },
        ]),
      });

      const branches: BranchCache[] = [{ ...branchCache, branchName: 'b1' }];
      const cache = partial<RepoCacheData>({
        branches,
      });
      getCacheSpy.mockReturnValueOnce(cache);
      isCacheModifiedSpy.mockReturnValueOnce(false);

      runBranchSummary(config);

      expect(logger.debug).toHaveBeenCalledTimes(2);
    });
  });
});
