import is from '@sindresorhus/is';
import * as git from '../../../util/git';
import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import { DefaultGitScm } from '../default-scm';
import { commitFiles, isGHApp } from './';

export function sanitizeMentions(input: string): string {
  return input.replaceAll('@', '@\u{8203}');
}

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    let platformCommit = commitConfig.platformCommit;
    if (platformCommit === 'auto' && isGHApp()) {
      platformCommit = 'enabled';
    }

    const sanitizedMessage = is.array(commitConfig.message)
      ? commitConfig.message.map(sanitizeMentions)
      : sanitizeMentions(commitConfig.message);
    commitConfig.message = sanitizedMessage;

    return platformCommit === 'enabled'
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }
}
