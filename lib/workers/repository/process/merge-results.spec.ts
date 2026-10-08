import { logger, partial, platform, scm } from '~test/util.ts';
import type { BranchConfig } from '../../types.ts';
import { reconcileRequestedMerges } from './merge-results.ts';

describe('workers/repository/process/merge-results', () => {
  let branches: BranchConfig[];

  beforeEach(() => {
    branches = [
      partial<BranchConfig>({
        branchName: 'renovate/a',
        prNo: 1,
        prTitle: 'Update a',
        pruneBranchAfterAutomerge: true,
      }),
      partial<BranchConfig>({ branchName: 'renovate/b', prNo: 2 }),
    ];
  });

  it('does nothing if the platform reports no results', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([]);

    await reconcileRequestedMerges(branches);

    expect(branches[0].result).toBeUndefined();
    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('does nothing if the platform returns no results', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce(undefined as never);

    await reconcileRequestedMerges(branches);

    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('marks a merged PR as automerged and deletes its branch', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 1, status: 'merged' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(branches[0].result).toBe('automerged');
    expect(scm.deleteBranch).toHaveBeenCalledWith('renovate/a');
    expect(logger.logger.info).toHaveBeenCalledWith(
      { pr: 1, prTitle: 'Update a', branchName: 'renovate/a' },
      'PR automerged',
    );
  });

  it('keeps the branch if pruning is disabled', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 2, status: 'merged' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(branches[1].result).toBe('automerged');
    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('only warns if deleting the branch fails', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 1, status: 'merged' },
    ]);
    scm.deleteBranch.mockRejectedValueOnce(new Error('fail'));

    await reconcileRequestedMerges(branches);

    expect(branches[0].result).toBe('automerged');
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { branchName: 'renovate/a', err: expect.any(Error) },
      'Branch auto-remove failed',
    );
  });

  it('logs a merged PR without a matching branch', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 3, status: 'merged' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(logger.logger.info).toHaveBeenCalledWith(
      { pr: 3, prTitle: undefined, branchName: undefined },
      'PR automerged',
    );
    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('logs refused, enqueued and pending merges', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 1, status: 'failed', message: 'Rule violation' },
      { number: 2, status: 'enqueued' },
      { number: 3, status: 'pending' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(logger.logger.info).toHaveBeenCalledWith(
      'PR #1 merge was refused by the platform: Rule violation',
    );
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'PR #2 is in the merge queue',
    );
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'Merge of PR #3 still pending at the end of the run',
    );
    expect(branches.every((branch) => !branch.result)).toBeTrue();
  });
});
