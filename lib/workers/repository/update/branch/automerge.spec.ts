import { getConfig, git, platform } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { BranchStatus } from '../../../../types';
import * as schedule from '../branch/schedule';
import { tryBranchAutomerge } from './automerge';

jest.mock('../../../../util/git');

describe('workers/repository/update/branch/automerge', () => {
  describe('tryBranchAutomerge', () => {
    const isScheduledSpy = jest.spyOn(schedule, 'isScheduledNow');
    let config: RenovateConfig;

    beforeEach(() => {
      config = getConfig();
      GlobalConfig.reset();
    });

    afterEach(() => {
      jest.clearAllMocks();
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
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });

    it('returns branch status error if branch status is failure', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      expect(await tryBranchAutomerge(config)).toBe('branch status error');
    });

    it('returns false if PR exists', async () => {
      platform.getBranchPr.mockResolvedValueOnce({} as never);
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      expect(await tryBranchAutomerge(config)).toBe(
        'automerge aborted - PR exists'
      );
    });

    it('returns false if automerge fails', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      git.mergeBranch.mockImplementationOnce(() => {
        throw new Error('merge error');
      });
      expect(await tryBranchAutomerge(config)).toBe('failed');
    });

    it('returns true if automerge succeeds', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      expect(await tryBranchAutomerge(config)).toBe('automerged');
    });

    it('returns true if automerge succeeds (dry-run)', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      GlobalConfig.set({ dryRun: 'full' });
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      expect(await tryBranchAutomerge(config)).toBe('automerged');
    });
  });
});
