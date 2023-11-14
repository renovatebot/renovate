import { partial, platform } from '../../../../../test/util';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import type { BranchConfig } from '../../../types';
import { prAlreadyExisted } from './check-existing';

describe('workers/repository/update/branch/check-existing', () => {
  describe('prAlreadyExisted', () => {
    let config: BranchConfig;

    beforeEach(() => {
      config = {
        baseBranch: 'base-branch',
        manager: 'some-manager',
        upgrades: [],
        branchName: 'some-branch',
        prTitle: 'some-title',
      } satisfies BranchConfig;
    });

    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      expect(await prAlreadyExisted(config)).toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(0);
    });

    it('returns false if check misses', async () => {
      config.recreateClosed = false;
      expect(await prAlreadyExisted(config)).toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });

    it('returns true if first check hits', async () => {
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ number: 12 }));
      platform.getPr.mockResolvedValueOnce(
        partial<Pr>({
          number: 12,
          state: 'closed',
        }),
      );
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });

    it('returns true if second check hits', async () => {
      config.branchPrefixOld = 'deps/';
      platform.findPr.mockResolvedValueOnce(null);
      platform.findPr.mockResolvedValueOnce(partial<Pr>({ number: 12 }));
      platform.getPr.mockResolvedValueOnce(
        partial<Pr>({
          number: 12,
          state: 'closed',
        }),
      );
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(
        `Found closed PR with current title`,
      );
    });
  });
});
