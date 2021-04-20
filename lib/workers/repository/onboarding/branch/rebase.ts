import { getAdminConfig } from '../../../../config/admin';
import { configFileNames } from '../../../../config/app-strings';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import {
  commitFiles,
  getFile,
  isBranchModified,
  isBranchStale,
} from '../../../../util/git';
import { getOnboardingConfig } from './config';

const defaultConfigFile = (config: RenovateConfig): string =>
  configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
    : configFileNames[0];

function getCommitMessage(config: RenovateConfig): string {
  const configFile = defaultConfigFile(config);
  let commitMessage: string;
  // istanbul ignore if
  if (config.semanticCommits === 'enabled') {
    commitMessage = config.semanticCommitType;
    if (config.semanticCommitScope) {
      commitMessage += `(${config.semanticCommitScope})`;
    }
    commitMessage += ': ';
    commitMessage += 'add ' + configFile;
  } else {
    commitMessage = 'Add ' + configFile;
  }
  return commitMessage;
}

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
  const contents = await getOnboardingConfig(config);
  if (
    contents === existingContents &&
    !(await isBranchStale(config.onboardingBranch))
  ) {
    logger.debug('Onboarding branch is up to date');
    return null;
  }
  logger.debug('Rebasing onboarding branch');
  // istanbul ignore next
  const commitMessage = getCommitMessage(config);

  // istanbul ignore if
  if (getAdminConfig().dryRun) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
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
