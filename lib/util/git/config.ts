import is from '@sindresorhus/is';

export const enum GitNoVerifyOption {
  Commit = 'commit',
  Push = 'push',
}

let noVerify: GitNoVerifyOption[] = [
  GitNoVerifyOption.Push,
  GitNoVerifyOption.Commit,
];

export function setNoVerify(value: GitNoVerifyOption[]): void {
  if (!is.array(value, is.string)) {
    // istanbul ignore next
    throw new Error('config error: gitNoVerify should be an array of strings');
  }
  noVerify = value;
}

export function getNoVerify(): GitNoVerifyOption[] {
  return noVerify;
}
