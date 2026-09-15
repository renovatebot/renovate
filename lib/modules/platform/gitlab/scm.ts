import { logger } from '../../../logger/index.ts';
import * as git from '../../../util/git/index.ts';
import type { CommitFilesConfig } from '../../../util/git/types.ts';
import type { LongCommitSha } from '../../../util/schema-utils/git.ts';
import { DefaultGitScm } from '../default-scm.ts';
import { commitFiles } from './index.ts';

export class GitlabScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    if (commitConfig.platformCommit === 'enabled') {
      logger.debug(
        {
          branchName: commitConfig.branchName,
          platformCommit: commitConfig.platformCommit,
        },
        'GitLab platformCommit enabled: using platform API commit path',
      );
      return commitFiles(commitConfig);
    }

    logger.debug(
      {
        branchName: commitConfig.branchName,
        platformCommit: commitConfig.platformCommit,
      },
      'GitLab platformCommit disabled or auto: using git push commit path',
    );
    return git.commitFiles(commitConfig);
  }
}
