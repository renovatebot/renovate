import { logger, partial, platform, scm } from '~test/util.ts';
import type { BranchConfig } from '../../types.ts';
import { reconcileRequestedMerges } from './merge-results.ts';

describe('workers/repository/process/merge-results', () => {
  let branches: BranchConfig[];

  beforeEach(() => {
    branches = [
      partial<BranchConfig>({
        branchName: 'renovate/a',
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

  it('does nothing if the platform has no merge results', async () => {
    const getRequestedMergeResults = platform.getRequestedMergeResults;
    // @ts-expect-error -- simulate a platform without the optional hook
    platform.getRequestedMergeResults = undefined;

    try {
      await reconcileRequestedMerges(branches);
    } finally {
      platform.getRequestedMergeResults = getRequestedMergeResults;
    }

    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('marks a merged PR as automerged and deletes its branch', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 1, branchName: 'renovate/a', status: 'merged' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(branches[0]).toMatchObject({ result: 'automerged', prNo: 1 });
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

    expect(branches[1]).toMatchObject({ result: 'automerged', prNo: 2 });
    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('only warns if deleting the branch fails', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      { number: 1, branchName: 'renovate/a', status: 'merged' },
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
      { number: 3, branchName: 'renovate/gone', status: 'merged' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(logger.logger.info).toHaveBeenCalledWith(
      { pr: 3, prTitle: undefined, branchName: 'renovate/gone' },
      'PR automerged',
    );
    expect(scm.deleteBranch).not.toHaveBeenCalled();
  });

  it('logs refused, enqueued and pending merges', async () => {
    platform.getRequestedMergeResults.mockResolvedValueOnce([
      {
        number: 1,
        branchName: 'renovate/a',
        status: 'failed',
        message: 'Rule violation',
      },
      { number: 2, status: 'enqueued' },
      { number: 3, status: 'pending' },
    ]);

    await reconcileRequestedMerges(branches);

    expect(logger.logger.info).toHaveBeenCalledWith(
      { pr: 1, branchName: 'renovate/a', message: 'Rule violation' },
      'PR merge was refused by the platform',
    );
    expect(logger.logger.debug).toHaveBeenCalledWith(
      { pr: 2, branchName: 'renovate/b' },
      'PR is in the merge queue',
    );
    expect(logger.logger.debug).toHaveBeenCalledWith(
      { pr: 3, branchName: undefined },
      'Merge still pending at the end of the run',
    );
    expect(branches.every((branch) => !branch.result)).toBeTrue();
  });
});
