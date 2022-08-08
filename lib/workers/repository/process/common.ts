import type { RenovateConfig } from '../../../config/types';

export function baseBranchesEqualsDefault({
  baseBranches,
  defaultBranch,
}: RenovateConfig): boolean {
  return (
    !!defaultBranch &&
    baseBranches?.length === 1 &&
    baseBranches.includes(defaultBranch)
  );
}
