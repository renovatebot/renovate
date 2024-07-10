import { logger } from '../../../logger';
import type { BranchConfig } from '../../types';

export function sortBranches(branches: Partial<BranchConfig>[]): void {
  // Sort branches
  const sortOrder = [
    'pin',
    'digest',
    'patch',
    'minor',
    'major',
    'lockFileMaintenance',
  ];
  logger.trace({ branches }, 'branches');
  branches.sort((a, b) => {
    if (a.isVulnerabilityAlert && !b.isVulnerabilityAlert) {
      return -1;
    }
    if (!a.isVulnerabilityAlert && b.isVulnerabilityAlert) {
      return 1;
    }

    // TODO #22198
    const prPriorityDiff = getPrPriority(b) - getPrPriority(a);
    if (prPriorityDiff !== 0) {
      return prPriorityDiff;
    }
    // TODO #22198
    const sortDiff =
      sortOrder.indexOf(a.updateType!) - sortOrder.indexOf(b.updateType!);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // TODO #22198
    // Sort by prTitle if updateType is the same
    return a.prTitle! < b.prTitle! ? -1 : 1;
  });
}

function getPrPriority(branch: Partial<BranchConfig>): number {
  return branch.prPriority ?? 0;
}
