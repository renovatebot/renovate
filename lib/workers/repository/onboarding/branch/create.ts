import { RenovateConfig } from '../../../../config';
import { configFileNames } from '../../../../config/app-strings';
import { logger } from '../../../../logger';
import { commitFiles } from '../../../../util/git';
import { getOnboardingConfig } from './config';

const defaultConfigFile = configFileNames[0];

export function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const contents = getOnboardingConfig(config);
  logger.debug('Creating onboarding branch');

  let prefix: string;
  if (config.commitMessagePrefix) {
    prefix = config.commitMessagePrefix;
  } else if (config.semanticCommits) {
    prefix = config.semanticCommitType;
    if (config.semanticCommitScope) {
      prefix += `(${config.semanticCommitScope})`;
    }
  }
  let commitMessageBody = `${prefix ? ': add' : 'Add'} ${defaultConfigFile}`;
  if (config.onboardingCommitMessageBody) {
    commitMessageBody = config.onboardingCommitMessageBody;
  }

  const commitMessage = `${prefix || ''}${commitMessageBody}`;

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
