import { GlobalConfig } from '../../../config/global.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import type { FileChange } from '../../../util/git/types.ts';
import { compileCommitBodyAndTrailers } from './commit-body.ts';
import type { CommitMessageConfig } from './commit-message-factory.ts';
import { CommitMessageFactory } from './commit-message-factory.ts';

/**
 * Builds the commit message for a commit which writes a Renovate config file: the shared prefix and semantic commit handling of `CommitMessageFactory`, with a subject supplied by the caller.
 */
export function createConfigFileCommitMessage(
  config: CommitMessageConfig,
  subject: string,
): string {
  const commitMessageFactory = new CommitMessageFactory(config);
  const commitMessage = commitMessageFactory.create();
  commitMessage.subject = subject;
  return commitMessage.toString();
}

export interface CommitConfigFileConfig {
  /** Supplies `baseBranch`, `platformCommit`, `commitBody`, `commitTrailers` and `gitAuthor` */
  config: Partial<RenovateConfig>;
  branchName: string;
  /** Called only once the dry run check has passed, so that a dry run neither checks out a branch nor formats a file */
  getFiles: () => FileChange[] | Promise<FileChange[]>;
  message: string;
  /** Only needed by Gerrit platform */
  prTitle: string;
  force?: boolean;
  /** Logged instead of committing when `dryRun` is enabled */
  dryRunMessage: string;
}

/**
 * Commits a Renovate config file to its own branch, as the onboarding and the config migration workers both do when they create or rebase their branch.
 */
export async function commitConfigFile({
  config,
  branchName,
  getFiles,
  message,
  prTitle,
  force,
  dryRunMessage,
}: CommitConfigFileConfig): Promise<string | null> {
  if (GlobalConfig.get('dryRun')) {
    logger.info(dryRunMessage);
    return null;
  }

  const compiled = compileCommitBodyAndTrailers(config, message, {
    // only allow the gitAuthor template value in the commitBody and commitTrailers
    gitAuthor: config.gitAuthor,
  });

  return await scm.commitAndPush({
    baseBranch: config.baseBranch,
    branchName,
    files: await getFiles(),
    message: compiled.message,
    trailers: compiled.trailers,
    platformCommit: config.platformCommit,
    force,
    // Only needed by Gerrit platform
    prTitle,
  });
}
