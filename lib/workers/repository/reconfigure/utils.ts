import is from '@sindresorhus/is';
import { BranchStatus } from '../../../types/branch-status';
import { platform } from '../../../modules/platform';

export function getReconfigureBranchName(prefix: string): string {
  return `${prefix}reconfigure`;
}

export async function setBranchStatus(
  branchName: string,
  description: string,
  state: BranchStatus,
  context?: string | null,
): Promise<void> {
  if (!is.nonEmptyString(context)) {
    // already logged this case when validating the status check
    return;
  }

  await platform.setBranchStatus({
    branchName,
    context,
    description,
    state,
  });
}
