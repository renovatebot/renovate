import { RenovateConfig } from '../../../../config';
import { configFileNames } from '../../../../config/app-strings';
import { logger } from '../../../../logger';
import { commitFiles } from '../../../../util/git';
import { formatCommitMessagePrefix } from '../../util/commit-message';
import { getOnboardingConfig } from './config';

const defaultConfigFile = configFileNames[0];

export function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const contents = getOnboardingConfig(config);
  logger.debug('Creating onboarding branch');

  let commitMessagePrefix = '';
  if (config.commitMessagePrefix) {
    commitMessagePrefix = config.commitMessagePrefix;
  } else if (config.semanticCommits === 'enabled') {
    commitMessagePrefix = config.semanticCommitType;
    if (config.semanticCommitScope) {
      commitMessagePrefix += `(${config.semanticCommitScope})`;
    }
  }
  if (commitMessagePrefix) {
    commitMessagePrefix = formatCommitMessagePrefix(commitMessagePrefix);
  }

  let onboardingCommitMessage: string;
  if (config.onboardingCommitMessage) {
    onboardingCommitMessage = config.onboardingCommitMessage;
  } else {
    onboardingCommitMessage = `${
      commitMessagePrefix ? 'add' : 'Add'
    } ${defaultConfigFile}`;
  }

  const commitMessage = `${commitMessagePrefix} ${onboardingCommitMessage}`.trim();

  // istanbul ignore if
  if (config.dryRun) {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }
  return commitFiles({
    branchName: config.onboardingBranch,
    files: [
      {
        name: defaultConfigFile,
        contents,
      },
    ],
    message: commitMessage,
  });
}
