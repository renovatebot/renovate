const { checkOnboardingBranch } = require('../onboarding/branch');
const { checkIfConfigured } = require('../configured');

const { checkBaseBranch } = require('./base');
const { mergeRenovateConfig } = require('./config');

async function initRepo(input) {
  let config = { ...input, errors: [], warnings: [] };
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  checkIfConfigured(config);
  config = await checkBaseBranch(config);
  return config;
}

module.exports = {
  initRepo,
};
