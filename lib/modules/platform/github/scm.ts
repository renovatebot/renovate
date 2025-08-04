import { logger } from '../../../logger';
import * as git from '../../../util/git';
import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import { DefaultGitScm } from '../default-scm';
import { commitFiles, isGHApp } from './';

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    let platformCommit = commitConfig.platformCommit;
    if (platformCommit === 'auto' && isGHApp()) {
      logger.debug('Using platform commit for GitHub App');
      platformCommit = 'enabled';
    }

    return platformCommit === 'enabled'
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }
}
