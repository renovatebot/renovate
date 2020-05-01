import { RenovateConfig } from '../../../../config';
import { configFileNames } from '../../../../config/app-strings';
import { logger } from '../../../../logger';
import { platform } from '../../../../platform';
import { getOnboardingConfig } from './config';

const defaultConfigFile = configFileNames[0];

function getCommitMessage(config: RenovateConfig): string {
  let commitMessage: string;
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
  return commitMessage;
}

export async function rebaseOnboardingBranch(
  config: RenovateConfig
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');
  const pr = await platform.getBranchPr(config.onboardingBranch);
  if (pr.isModified) {
    logger.debug('Onboarding branch has been edited and cannot be rebased');
    return null;
  }
  const existingContents = await platform.getFile(
    defaultConfigFile,
    config.onboardingBranch
  );
  const contents = await getOnboardingConfig(config);
  if (contents === existingContents && !pr.isStale) {
    logger.debug('Onboarding branch is up to date');
    return null;
  }
  logger.debug('Rebasing onboarding branch');
  // istanbul ignore next
  const commitMessage = getCommitMessage(config);

  // istanbul ignore if
  if (config.dryRun) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
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
