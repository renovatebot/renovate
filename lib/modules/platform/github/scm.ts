import { isString } from '@sindresorhus/is';
import * as git from '../../../util/git/index.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import type { LongCommitSha } from '../../../util/schema-utils/git.ts';
import { DefaultGitScm } from '../default-scm.ts';
import {
  assertPrNotInMergeQueue,
  commitFiles,
  isGHApp,
  massageCommitMessage,
} from './index.ts';

export class GithubScm extends DefaultGitScm {
  override async commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    let platformCommit = commitConfig.platformCommit;
    if (platformCommit === 'auto' && isGHApp()) {
      platformCommit = 'enabled';
    }

    // a queued PR could otherwise merge before the pushed changes take effect
    await assertPrNotInMergeQueue(
      commitConfig.branchName,
      commitConfig.baseBranch,
    );

    // a `commitBody` can contain release notes, whose links would otherwise add a reference to every linked issue and PR
    const message = isString(commitConfig.message)
      ? massageCommitMessage(commitConfig.message)
      : commitConfig.message.map((part) => massageCommitMessage(part));
    const massagedConfig = { ...commitConfig, message };

    return platformCommit === 'enabled'
      ? commitFiles(massagedConfig)
      : git.commitFiles(massagedConfig);
  }
}
