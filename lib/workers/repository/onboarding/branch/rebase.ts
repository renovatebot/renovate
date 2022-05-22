import { configFileNames } from '../../../../config/app-strings';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import { getFile, isBranchModified, isBranchStale } from '../../../../util/git';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

const defaultConfigFile = (config: RenovateConfig): string =>
  configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : configFileNames[0];

export async function rebaseOnboardingBranch(
  config: RenovateConfig
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');
  if (await isBranchModified(config.onboardingBranch)) {
    logger.debug('Onboarding branch has been edited and cannot be rebased');
    return null;
  }
  const configFile = defaultConfigFile(config);
  const existingContents = await getFile(configFile, config.onboardingBranch);
  const contents = await getOnboardingConfigContents(config, configFile);
  if (
    contents === existingContents &&
    !(await isBranchStale(config.onboardingBranch))
  ) {
    logger.debug('Onboarding branch is up to date');
    return null;
  }
  logger.debug('Rebasing onboarding branch');
  // istanbul ignore next
  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile
  );
  const commitMessage = commitMessageFactory.create();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
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
