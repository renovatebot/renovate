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

    // TODO #7154
    if (a.prPriority !== b.prPriority) {
      return b.prPriority! - a.prPriority!;
    }
    // TODO #7154
    const sortDiff =
      sortOrder.indexOf(a.updateType!) - sortOrder.indexOf(b.updateType!);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // TODO #7154
    // Sort by prTitle if updateType is the same
    return a.prTitle! < b.prTitle! ? -1 : 1;
  });
}
