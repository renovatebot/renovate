const { logger } = require('../../../../logger');
const { getOnboardingConfig } = require('./config');
const {
  configFileNames,
  onboardingBranch,
} = require('../../../../config/app-strings');
const { platform } = require('../../../../platform');

const defaultConfigFile = configFileNames[0];

function getCommitMessage(config) {
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
  return commitMessage;
}

async function rebaseOnboardingBranch(config) {
  logger.debug('Checking if onboarding branch needs rebasing');
  const pr = await platform.getBranchPr(onboardingBranch);
  if (pr.isModified) {
    logger.info('Onboarding branch has been edited and cannot be rebased');
    return;
  }
  const existingContents = await platform.getFile(
    defaultConfigFile,
    onboardingBranch
  );
  const contents = await getOnboardingConfig(config);
  if (contents === existingContents && !pr.isStale) {
    logger.info('Onboarding branch is up to date');
    return;
  }
  logger.info('Rebasing onboarding branch');
  // istanbul ignore next
  const commitMessage = getCommitMessage(config);

  // istanbul ignore if
  if (config.dryRun) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
  } else {
    await platform.commitFilesToBranch(
      onboardingBranch,
      [
        {
          name: defaultConfigFile,
          contents,
        },
      ],
      commitMessage
    );
  }
}

module.exports = {
  rebaseOnboardingBranch,
};
