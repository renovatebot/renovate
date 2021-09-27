import { configFileNames } from '../../../../config/app-strings';
import { getGlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitFiles } from '../../../../util/git';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

const defaultConfigFile = configFileNames[0];

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const contents = await getOnboardingConfigContents(config);
  logger.debug('Creating onboarding branch');

  const configFile = configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : defaultConfigFile;

  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile
  );
  const commitMessage = commitMessageFactory.create();

  // istanbul ignore if
  if (getGlobalConfig().dryRun) {
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
    message: commitMessage.toString(),
  });
}
