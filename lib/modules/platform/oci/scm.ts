import { DefaultGitScm } from '../default-scm.ts';

export class OciScm extends DefaultGitScm {
  override mergeAndPush(_branchName: string): Promise<void> {
    return Promise.reject(
      new Error(
        'OCI branch automerge is not supported; merge pull requests manually',
      ),
    );
  }
}
