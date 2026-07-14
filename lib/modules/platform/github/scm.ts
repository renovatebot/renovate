import * as git from '../../../util/git/index.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import type { LongCommitSha } from '../../../util/schema-utils/git.ts';
import { DefaultGitScm } from '../default-scm.ts';
import { commitFiles, isPlatformCommitEnabled } from './index.ts';

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    return isPlatformCommitEnabled()
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }
}
