import { logger } from '../../../logger/index.ts';
import type { RequestedMergeResult } from '../../../modules/platform/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { coerceArray } from '../../../util/array.ts';
import type { BranchConfig } from '../../types.ts';
import { pruneAutomergedBranch } from '../update/pr/automerge.ts';

async function applyMergedResult(
  result: RequestedMergeResult,
  branch: BranchConfig | undefined,
): Promise<void> {
  logger.info(
    {
      pr: result.number,
      prTitle: branch?.prTitle,
      branchName: branch?.branchName,
    },
    'PR automerged',
  );
  if (!branch) {
    return;
  }
  branch.result = 'automerged';
  await pruneAutomergedBranch(
    branch.branchName,
    branch.pruneBranchAfterAutomerge,
  );
}

/**
 * Looks up the results of the merges the platform requested asynchronously in
 * this run, so merged PRs are reported as automerged.
 */
export async function reconcileRequestedMerges(
  branches: BranchConfig[],
): Promise<void> {
  const results = await platform.getRequestedMergeResults?.();
  for (const result of coerceArray(results)) {
    const branch = branches.find(({ prNo }) => prNo === result.number);
    switch (result.status) {
      case 'merged':
        await applyMergedResult(result, branch);
        break;
      case 'failed':
        logger.info(
          `PR #${result.number} merge was refused by the platform: ${result.message}`,
        );
        break;
      case 'enqueued':
        logger.debug(`PR #${result.number} is in the merge queue`);
        break;
      default:
        logger.debug(
          `Merge of PR #${result.number} still pending at the end of the run`,
        );
    }
  }
}
