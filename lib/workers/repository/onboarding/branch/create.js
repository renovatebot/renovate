const { getOnboardingConfig } = require('./config');

async function createOnboardingBranch(config) {
  logger.debug('createOnboardingBranch()');
  const contents = await getOnboardingConfig(config);
  logger.info('Creating onboarding branch');
  await platform.commitFilesToBranch(
    `renovate/configure`,
    [
      {
        name: 'renovate.json',
        contents,
      },
    ],
    'Add renovate.json',
    undefined,
    config.gitAuthor,
    config.gitPrivateKey
  );
}

module.exports = {
  getOnboardingConfig,
  createOnboardingBranch,
};
