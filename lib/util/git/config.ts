export type GitNoVerifyOption = 'commit' | 'push';

let noVerify: GitNoVerifyOption[] = [];

export function setNoVerify(value: GitNoVerifyOption[]): void {
  noVerify = value;
}

export function getNoVerify(): GitNoVerifyOption[] {
  return noVerify;
}
