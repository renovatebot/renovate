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
    // TODO: fix this sorting for multiple matchUpdateTypes elements
    const sortDiff =
      sortOrder.indexOf(a.matchUpdateTypes ? a.matchUpdateTypes[0] : null) -
      sortOrder.indexOf(b.matchUpdateTypes ? b.matchUpdateTypes[0] : null);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // Sort by prTitle if matchUpdateTypes is the same
    return a.prTitle < b.prTitle ? -1 : 1;
  });
}
