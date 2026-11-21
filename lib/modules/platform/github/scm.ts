import { isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import * as git from '../../../util/git/index.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import { DefaultGitScm } from '../default-scm.ts';
import type { PreparedCommit } from '../types.ts';
import {
  assertPrNotInMergeQueue,
  isGHApp,
  massageCommitMessage,
  pushCommitFiles,
} from './index.ts';

export class GithubScm extends DefaultGitScm {
  override async prepareCommit(
    commitConfig: CommitFilesConfig,
  ): Promise<PreparedCommit | null> {
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

    const commitResult = await git.prepareCommit(massagedConfig);
    if (!commitResult) {
      if (platformCommit === 'enabled') {
        logger.debug(
          {
            branchName: commitConfig.branchName,
            files: commitConfig.files.map(({ path }) => path),
          },
          `Platform-native commit: unable to prepare for commit`,
        );
      }
      return null;
    }

    if (platformCommit === 'enabled') {
      return {
        sha: commitResult.commitSha,
        push: () => pushCommitFiles(massagedConfig, commitResult),
      };
    }
    return {
      sha: commitResult.commitSha,
      push: () => git.pushPreparedCommit(massagedConfig, commitResult),
    };
  }
}
