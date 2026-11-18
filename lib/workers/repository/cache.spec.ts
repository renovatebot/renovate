import { partial } from '~test/util.ts';
import * as _repoCache from '../../util/cache/repository/index.ts';
import type { RepoCacheData } from '../../util/cache/repository/types.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../types.ts';
import { setBranchCache } from './cache.ts';

vi.mock('../../util/cache/repository/index.ts');

const repoCache = vi.mocked(_repoCache);

describe('workers/repository/cache', () => {
  describe('setBranchCache()', () => {
    it('strips credentials from cached upgrade fields', async () => {
      const cache = partial<RepoCacheData>({});
      repoCache.getCache.mockReturnValue(cache);
      const branches = partial<BranchConfig[]>([
        {
          branchName: 'renovate/dep-1.x',
          baseBranch: 'main',
          manager: 'npm',
          upgrades: [
            partial<BranchUpgradeConfig>({
              packageName: 'https://user:pass@registry.example.com/dep',
              sourceUrl: 'https://ghp_0123456789abcdef@github.com/org/repo',
              currentValue:
                'getReleases:https://user:pass@registry.example.com/dep',
              newValue: '2.0.0',
              depName: 'dep',
            }),
          ],
        },
      ]);

      await setBranchCache(branches);

      expect(cache.branches?.[0].upgrades?.[0]).toMatchObject({
        packageName: 'https://registry.example.com/dep',
        sourceUrl: 'https://github.com/org/repo',
        currentValue: 'getReleases:https://registry.example.com/dep',
        newValue: '2.0.0',
        depName: 'dep',
      });
    });
  });
});
