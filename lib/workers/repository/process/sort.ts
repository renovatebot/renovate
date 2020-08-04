import { logger } from '../../../logger';
import { BranchConfig } from '../../common';

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
    if (a.prPriority !== b.prPriority) {
      return b.prPriority - a.prPriority;
    }
    // TODO: fix this sorting for multiple updateTypes elements
    const sortDiff =
      sortOrder.indexOf(a.updateTypes ? a.updateTypes[0] : null) -
      sortOrder.indexOf(b.updateTypes ? b.updateTypes[0] : null);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // Sort by prTitle if updateTypes is the same
    return a.prTitle < b.prTitle ? -1 : 1;
  });
}
