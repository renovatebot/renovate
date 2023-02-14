import * as git from '../../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import { DefaultGitScm } from '../default-scm';
import type { PlatformScm } from '../types';
import { commitFiles } from './index';

export class GithubScm extends DefaultGitScm {
  public static override instance: PlatformScm = new this();

  override commitAndPush(
    commitConfig: CommitFilesConfig
  ): Promise<CommitSha | null> {
    return commitConfig.platformCommit
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }
}
