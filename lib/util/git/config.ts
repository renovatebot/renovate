export type GitNoVerifyOption = 'commit' | 'push';

let noVerify: GitNoVerifyOption[] = ['commit', 'push'];

export function setNoVerify(value: GitNoVerifyOption[]): void {
  noVerify = value;
}

export function getNoVerify(): GitNoVerifyOption[] {
  return noVerify;
}
