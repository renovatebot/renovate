import type { RenovateConfig } from '../../../config/types';

export function baseBranchesEqualsDefault({
  baseBranches,
  defaultBranch,
}: RenovateConfig): boolean {
  return baseBranches?.toString() === [defaultBranch].toString();
}
