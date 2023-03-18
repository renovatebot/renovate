import hasha from 'hasha';
import type { PlatformPrOptions } from './types';

export function repoFingerprint(
  repoId: number | string,
  endpoint: string | undefined
): string {
  const input = endpoint ? `${endpoint}::${repoId}` : `${repoId}`;
  const fingerprint = hasha(input);
  return fingerprint;
}

export function getNewBranchName(branchName?: string): string | undefined {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}

export function getDefaultPlatformPrOptions(): PlatformPrOptions {
  return {
    azureAutoApprove: false,
    azureWorkItemId: 0,
    bbUseDefaultReviewers: false,
    gitLabIgnoreApprovals: 0,
  };
}
