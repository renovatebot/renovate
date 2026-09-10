import { Fixtures } from '~test/fixtures.ts';
import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import * as cache from '../../../util/cache/repository/index.ts';
import type {
  BaseBranchCache,
  BranchCache,
  BranchUpgradeCache,
  RepoCacheData,
} from '../../../util/cache/repository/types.ts';
import {
  getUpdateSummary,
  runBranchSummary,
  runRenovateRepoStats,
} from './repository-statistics.ts';

vi.mock('../../../modules/platform/github/pr.ts');
vi.mock('../../../util/http/github.ts');

const prJson = Fixtures.getJson('./pr-list.json');
const result = Object.keys(prJson).map((key) => {
  return prJson[key];
});

describe('workers/repository/finalize/repository-statistics', () => {
  let config: RenovateConfig;

  describe('runRenovateRepoStats', () => {
    beforeEach(() => {
      vi.mocked(platform.getPrList).mockReturnValue(prJson);
      config = partial<RenovateConfig>({
        defaultBranch: 'main',
        repository: 'owner/repo',
      });

      GlobalConfig.set({ onboardingPrTitle: 'Configure Renovate' });
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
    const getCacheSpy = vi.spyOn(cache, 'getCache');
    const isCacheModifiedSpy = vi.spyOn(cache, 'isCacheModified');
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
        // @ts-expect-error -- TODO: should we remove this test?
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
            updateType: 'patch',
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

      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(Object),
        'Branch summary',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(Object),
        'branches info extended',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(Object),
        'Updates summary',
      );
    });
  });

  describe('getUpdateSummary', () => {
    it('returns empty array for no branches', () => {
      expect(getUpdateSummary([])).toEqual([]);
    });

    it('groups by baseBranch and counts updateTypes from upgrades', () => {
      const branches: BranchCache[] = [
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'major',
            }),
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'major',
            }),
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'pin',
            }),
          ],
        }),
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [
            partial<BranchUpgradeCache>({
              manager: 'dockerfile',
              updateType: 'patch',
            }),
          ],
        }),
        partial<BranchCache>({
          baseBranch: 'next',
          upgrades: [
            partial<BranchUpgradeCache>({
              manager: 'gomod',
              updateType: 'replacement',
            }),
            partial<BranchUpgradeCache>({
              manager: 'gomod',
              updateType: 'pin',
            }),
          ],
        }),
      ];

      expect(getUpdateSummary(branches)).toEqual([
        {
          baseBranch: 'main',
          total: 4,
          vulnerabilityAlert: 0,
          updates: { major: 2, pin: 1, patch: 1 },
          managers: {
            npm: {
              total: 3,
              vulnerabilityAlert: 0,
              updates: { major: 2, pin: 1 },
            },
            dockerfile: {
              total: 1,
              vulnerabilityAlert: 0,
              updates: { patch: 1 },
            },
          },
        },
        {
          baseBranch: 'next',
          total: 2,
          vulnerabilityAlert: 0,
          updates: { replacement: 1, pin: 1 },
          managers: {
            gomod: {
              total: 2,
              vulnerabilityAlert: 0,
              updates: { replacement: 1, pin: 1 },
            },
          },
        },
      ]);
    });

    it('ignores upgrades without an updateType', () => {
      const branches: BranchCache[] = [
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [
            partial<BranchUpgradeCache>({}),
            partial<BranchUpgradeCache>({}),
          ],
        }),
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [partial<BranchUpgradeCache>({})],
        }),
      ];

      expect(getUpdateSummary(branches)).toEqual([
        {
          baseBranch: 'main',
          total: 0,
          vulnerabilityAlert: 0,
          updates: {},
          managers: {},
        },
      ]);

      // and logs to inform the user
      expect(logger.debug).toHaveBeenCalledWith(
        expect.toBeObject(),
        'Found an upgrade without an updateType, which should not be possible',
      );
    });

    it('treats missing baseBranch as the default branch (empty string)', () => {
      const branches: BranchCache[] = [
        partial<BranchCache>({
          upgrades: [
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'minor',
            }),
          ],
        }),
      ];

      expect(getUpdateSummary(branches)).toEqual([
        {
          baseBranch: '',
          total: 1,
          vulnerabilityAlert: 0,
          updates: { minor: 1 },
          managers: {
            npm: {
              total: 1,
              vulnerabilityAlert: 0,
              updates: { minor: 1 },
            },
          },
        },
      ]);
    });

    it('treats missing manager as empty string', () => {
      const branches: BranchCache[] = [
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [partial<BranchUpgradeCache>({ updateType: 'minor' })],
        }),
      ];

      expect(getUpdateSummary(branches)).toEqual([
        {
          baseBranch: 'main',
          total: 1,
          vulnerabilityAlert: 0,
          updates: { minor: 1 },
          managers: {
            '': {
              total: 1,
              vulnerabilityAlert: 0,
              updates: { minor: 1 },
            },
          },
        },
      ]);
    });

    it('counts vulnerability alerts in their own top-level field and also in their updateType bucket', () => {
      const branches: BranchCache[] = [
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'patch',
              isVulnerabilityAlert: true,
            }),
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'major',
              isVulnerabilityAlert: true,
            }),
            partial<BranchUpgradeCache>({
              manager: 'npm',
              updateType: 'major',
            }),
          ],
        }),
      ];

      expect(getUpdateSummary(branches)).toEqual([
        {
          baseBranch: 'main',
          total: 3,
          vulnerabilityAlert: 2,
          updates: { major: 2, patch: 1 },
          managers: {
            npm: {
              total: 3,
              vulnerabilityAlert: 2,
              updates: { major: 2, patch: 1 },
            },
          },
        },
      ]);
    });

    it('keeps a base branch entry even when it has no counted upgrades', () => {
      const branches: BranchCache[] = [
        partial<BranchCache>({
          baseBranch: 'main',
          upgrades: [],
        }),
      ];

      expect(getUpdateSummary(branches)).toEqual([
        {
          baseBranch: 'main',
          total: 0,
          vulnerabilityAlert: 0,
          updates: {},
          managers: {},
        },
      ]);
    });
  });
});
