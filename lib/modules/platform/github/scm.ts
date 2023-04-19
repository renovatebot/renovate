import * as git from '../../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import { DefaultGitScm } from '../default-scm';
import { commitFiles } from './';

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig
  ): Promise<CommitSha | null> {
    return commitConfig.platformCommit
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }
}
