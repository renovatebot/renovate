import { logger } from '../../../../logger/index.ts';
import type { BranchResult, PrBlockedBy } from '../../../types.ts';

const branchResults: Partial<Record<PrBlockedBy, BranchResult>> = {
  NeedsApproval: 'needs-pr-approval',
  AwaitingTests: 'pending',
  BranchAutomerge: 'done',
  Error: 'error',
};

/**
 * Maps the reason why no PR was created to the result of the branch.
 */
export function prBlockedByToResult(
  prBlockedBy: PrBlockedBy,
  isVulnerabilityAlert: boolean | undefined,
): BranchResult {
  if (prBlockedBy === 'RateLimited' && !isVulnerabilityAlert) {
    logger.debug('Reached PR limit - skipping PR creation');
    return 'pr-limit-reached';
  }

  // TODO: ensurePr should check for automerge itself (#9719)
  const result = branchResults[prBlockedBy];
  if (result) {
    return result;
  }

  logger.warn({ prBlockedBy }, 'Unknown PrBlockedBy result');
  return 'error';
}
