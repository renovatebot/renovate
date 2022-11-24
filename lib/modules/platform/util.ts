import hasha from 'hasha';

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
