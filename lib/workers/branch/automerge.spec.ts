import { tryBranchAutomerge } from './automerge';
import { defaultConfig, platform } from '../../../test/util';
import { RenovateConfig } from '../../config';
import {
  BRANCH_STATUS_FAILURE,
  BRANCH_STATUS_PENDING,
  BRANCH_STATUS_SUCCESS,
} from '../../constants/branch-constants';

describe('workers/branch/automerge', () => {
  describe('tryBranchAutomerge', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns false if not configured for automerge', async () => {
      config.automerge = false;
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });
    it('returns false if automergType is pr', async () => {
      config.automerge = true;
      config.automergeType = 'pr';
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });
    it('returns false if branch status is not success', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BRANCH_STATUS_PENDING);
      expect(await tryBranchAutomerge(config)).toBe('no automerge');
    });
    it('returns branch status error if branch status is failure', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BRANCH_STATUS_FAILURE);
      expect(await tryBranchAutomerge(config)).toBe('branch status error');
    });
    it('returns false if PR exists', async () => {
      platform.getBranchPr.mockResolvedValueOnce({} as never);
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BRANCH_STATUS_SUCCESS);
      expect(await tryBranchAutomerge(config)).toBe(
        'automerge aborted - PR exists'
      );
    });
    it('returns false if automerge fails', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BRANCH_STATUS_SUCCESS);
      platform.mergeBranch.mockImplementationOnce(() => {
        throw new Error('merge error');
      });
      expect(await tryBranchAutomerge(config)).toBe('failed');
    });
    it('returns true if automerge succeeds', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      platform.getBranchStatus.mockResolvedValueOnce(BRANCH_STATUS_SUCCESS);
      expect(await tryBranchAutomerge(config)).toBe('automerged');
    });
    it('returns true if automerge succeeds (dry-run)', async () => {
      config.automerge = true;
      config.automergeType = 'branch';
      config.dryRun = true;
      platform.getBranchStatus.mockResolvedValueOnce(BRANCH_STATUS_SUCCESS);
      expect(await tryBranchAutomerge(config)).toBe('automerged');
    });
  });
});
