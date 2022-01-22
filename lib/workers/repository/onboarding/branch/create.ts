import { configFileNames } from '../../../../config/app-strings';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { commitFiles } from '../../../../util/git';
import { CommitFilesConfig } from '../../../../util/git/types';
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
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }

  const commitConfig: CommitFilesConfig = {
    branchName: config.onboardingBranch,
    files: [
      {
        type: 'addition',
        path: configFile,
        contents,
      },
    ],
    message: commitMessage.toString(),
  };

  // istanbul ignore next
  const pushCallback = (config.platformCommit && platform.pushFiles) ?? null;

  return commitFiles(commitConfig, pushCallback);
}
