import is from '@sindresorhus/is';
import { SimpleGitOptions } from 'simple-git';

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

export function simpleGitConfig(): Partial<SimpleGitOptions> {
  return {
    completion: {
      onClose: true,
      onExit: false,
    },
  };
}
