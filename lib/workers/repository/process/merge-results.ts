import { logger } from '../../../logger/index.ts';
import type { RequestedMergeResult } from '../../../modules/platform/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import type { BranchConfig } from '../../types.ts';

function findBranch(
  branches: BranchConfig[],
  result: RequestedMergeResult,
): BranchConfig | undefined {
  return (
    branches.find((branch) => branch.branchName === result.branchName) ??
    branches.find((branch) => branch.prNo === result.number)
  );
}

async function applyMergedResult(
  result: RequestedMergeResult,
  branch: BranchConfig | undefined,
): Promise<void> {
  const branchName = branch?.branchName ?? result.branchName;
  logger.info(
    { pr: result.number, prTitle: branch?.prTitle, branchName },
    'PR automerged',
  );
  if (!branch) {
    return;
  }
  branch.result = 'automerged';
  branch.prNo ??= result.number;
  if (!branch.pruneBranchAfterAutomerge) {
    return;
  }
  try {
    await scm.deleteBranch(branch.branchName);
  } catch (err) {
    logger.warn(
      { branchName: branch.branchName, err },
      'Branch auto-remove failed',
    );
  }
}

/**
 * Looks up the results of the merges the platform requested asynchronously in
 * this run, so merged PRs are reported as automerged.
 */
export async function reconcileRequestedMerges(
  branches: BranchConfig[],
): Promise<void> {
  const results = await platform.getRequestedMergeResults?.();
  if (!results?.length) {
    return;
  }
  for (const result of results) {
    const branch = findBranch(branches, result);
    const branchName = branch?.branchName ?? result.branchName;
    switch (result.status) {
      case 'merged':
        await applyMergedResult(result, branch);
        break;
      case 'failed':
        logger.info(
          { pr: result.number, branchName, message: result.message },
          'PR merge was refused by the platform',
        );
        break;
      case 'enqueued':
        logger.debug(
          { pr: result.number, branchName },
          'PR is in the merge queue',
        );
        break;
      default:
        logger.debug(
          { pr: result.number, branchName },
          'Merge still pending at the end of the run',
        );
    }
  }
}
