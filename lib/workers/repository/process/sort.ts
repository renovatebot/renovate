import { logger } from '../../../logger';
import { BranchConfig } from '../../common';

export type SortBranchConfig = Pick<
  BranchConfig,
  'prPriority' | 'updateType' | 'prTitle'
> &
  Partial<BranchConfig>;

export function sortBranches(branches: SortBranchConfig[]): void {
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
    const sortDiff =
      sortOrder.indexOf(a.updateType) - sortOrder.indexOf(b.updateType);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // Sort by prTitle if updateType is the same
    return a.prTitle < b.prTitle ? -1 : 1;
  });
}
