import { partial, platform, scm } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import type { Pr } from '../../../../modules/platform/types';
import * as schedule from '../branch/schedule';
import { tryBranchAutomerge } from './automerge';

jest.mock('../../../../util/git');

describe('workers/repository/update/branch/automerge', () => {
  describe('tryBranchAutomerge', () => {
    const isScheduledSpy = jest.spyOn(schedule, 'isScheduledNow');
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>();
      GlobalConfig.reset();
      isScheduledSpy.mockReturnValue(true);
    });

    it('returns false if not configured for automerge', async () => {
      config.automerge = false;
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });

    it('returns false if automergeType is pr', async () => {
      config.automerge = true;
      config.automergeType = 'pr';
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });

    it('returns false if off schedule', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      isScheduledSpy.mockReturnValueOnce(false);
      expect(await tryBranchAutomerge(config)).toBe('off schedule');
    });

    it('returns false if branch status is not success', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce('yellow');
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });

    it('returns branch status error if branch status is failure', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce('red');
      expect(await tryBranchAutomerge(config)).toBe('branch status error');
    });

    it('returns false if PR exists', async () => {
      platform.getBranchPr.mockResolvedValueOnce(partial<Pr>());
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce('green');
      expect(await tryBranchAutomerge(config)).toBe(
        'automerge aborted - PR exists',
      );
    });

    it('returns false if automerge fails', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.baseBranch = 'test-branch';
      platform.getBranchStatus.mockResolvedValueOnce('green');
      scm.mergeAndPush.mockImplementationOnce(() => {
        throw new Error('merge error');
      });

      const res = await tryBranchAutomerge(config);

      expect(res).toBe('failed');
      expect(scm.checkoutBranch).toHaveBeenCalled();
    });

    it('returns true if automerge succeeds', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.baseBranch = 'test-branch';
      platform.getBranchStatus.mockResolvedValueOnce('green');

      const res = await tryBranchAutomerge(config);

      expect(res).toBe('automerged');
      expect(scm.checkoutBranch).toHaveBeenCalledWith('test-branch');
    });

    it('returns true if automerge succeeds (dry-run)', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      GlobalConfig.set({ dryRun: 'full' });
      platform.getBranchStatus.mockResolvedValueOnce('green');
      expect(await tryBranchAutomerge(config)).toBe('automerged');
    });
  });
});
