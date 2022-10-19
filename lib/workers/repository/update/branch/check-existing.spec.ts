import { getConfig, partial, platform } from '../../../../../test/util';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { PrState } from '../../../../types';
import type { BranchConfig } from '../../../types';
import { prAlreadyExisted } from './check-existing';

describe('workers/repository/update/branch/check-existing', () => {
  describe('prAlreadyExisted', () => {
    let config: BranchConfig;

    beforeEach(() => {
      // TODO: incompatible types (#7154)
      config = {
        ...getConfig(),
        branchName: 'some-branch',
        prTitle: 'some-title',
      } as BranchConfig;
      jest.resetAllMocks();
    });

    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      expect(await prAlreadyExisted(config)).toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(0);
    });

    it('returns false if check misses', async () => {
      config.recreatedClosed = true;
      expect(await prAlreadyExisted(config)).toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });

    it('returns true if first check hits', async () => {
      platform.findPr.mockResolvedValueOnce({ number: 12 } as never);
      platform.getPr.mockResolvedValueOnce({
        number: 12,
        state: PrState.Closed,
      } as never);
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
          state: PrState.Closed,
        })
      );
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(
        `Found closed PR with current title`
      );
    });
  });
});
