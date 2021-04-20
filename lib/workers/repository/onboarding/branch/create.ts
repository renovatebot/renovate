import { getAdminConfig } from '../../../../config/admin';
import { configFileNames } from '../../../../config/app-strings';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitFiles } from '../../../../util/git';
import { formatCommitMessagePrefix } from '../../util/commit-message';
import { getOnboardingConfig } from './config';

const defaultConfigFile = configFileNames[0];

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const contents = await getOnboardingConfig(config);
  logger.debug('Creating onboarding branch');

  const configFile = configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : defaultConfigFile;

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
    } ${configFile}`;
  }

  const commitMessage = `${commitMessagePrefix} ${onboardingCommitMessage}`.trim();

  // istanbul ignore if
  if (getAdminConfig().dryRun) {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }
  return commitFiles({
    branchName: config.onboardingBranch,
    files: [
      {
        name: configFile,
        contents,
      },
    ],
    message: commitMessage,
  });
}
