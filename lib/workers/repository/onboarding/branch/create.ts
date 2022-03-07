import { configFileNames } from '../../../../config/app-strings';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../platform/commit';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

const defaultConfigFile = configFileNames[0];

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  const configFile = configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : defaultConfigFile;

  logger.debug('createOnboardingBranch()');
  const contents = await getOnboardingConfigContents(config, configFile);
  logger.debug('Creating onboarding branch');

  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile
  );
  const commitMessage = commitMessageFactory.create();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun') === 'full') {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }

  return commitAndPush({
    branchName: config.onboardingBranch,
    files: [
      {
        type: 'addition',
        path: configFile,
        contents,
      },
    ],
    message: commitMessage.toString(),
    platformCommit: !!config.platformCommit,
  });
}
