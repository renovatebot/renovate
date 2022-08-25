import hasha from 'hasha';

export function repoFingerprint(
  repoId: number | string,
  endpoint: string | undefined
): string {
  const input = endpoint ? `${endpoint}::${repoId}` : `${repoId}`;
  const fingerprint = hasha(input);
  return fingerprint;
}
