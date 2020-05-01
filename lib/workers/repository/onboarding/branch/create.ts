import { RenovateConfig } from '../../../../config';
import { configFileNames } from '../../../../config/app-strings';
import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { getOnboardingConfig } from './config';

const defaultConfigFile = configFileNames[0];

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const contents = await getOnboardingConfig(config);
  logger.debug('Creating onboarding branch');
  let commitMessage;
  // istanbul ignore if
  if (config.semanticCommits) {
    commitMessage = config.semanticCommitType;
    if (config.semanticCommitScope) {
      commitMessage += `(${config.semanticCommitScope})`;
    }
    commitMessage += ': ';
    commitMessage += 'add ' + defaultConfigFile;
  } else {
    commitMessage = 'Add ' + defaultConfigFile;
  }
  // istanbul ignore if
  if (config.dryRun) {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }
  return platform.commitFilesToBranch({
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
