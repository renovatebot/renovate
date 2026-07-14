import * as git from '../../../util/git/index.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import type { LongCommitSha } from '../../../util/schema-utils/git.ts';
import { DefaultGitScm } from '../default-scm.ts';
import { commitFiles, isGHApp } from './index.ts';

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    let platformCommit = commitConfig.platformCommit;
    if (platformCommit === 'auto' && isGHApp()) {
      platformCommit = 'enabled';
    }

    return platformCommit === 'enabled'
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }
}
