const platform = require('../../../../platform');

async function createOnboardingBranch(config) {
  const { logger } = config;
  logger.debug('Creating onboarding branch');
  const renovateJson = {
    extends: ['config:base'],
  };
  logger.info({ renovateJson }, 'Creating onboarding branch');
  await platform.commitFilesToBranch(
    `${config.branchPrefix}configure`,
    [
      {
        name: 'renovate.json',
        contents: `${JSON.stringify(renovateJson, null, 2)}\n`,
      },
    ],
    'Add renovate.json'
  );
}

module.exports = {
  createOnboardingBranch,
};
