import { commitFiles } from '../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../util/git/types';
import { platform } from '.';

export function commitAndPush(
  commitConfig: CommitFilesConfig
): Promise<CommitSha | null> {
  return commitConfig.platformCommit && platform.commitFiles
    ? platform.commitFiles(commitConfig)
    : commitFiles(commitConfig);
}
