const { checkOnboardingBranch } = require('../onboarding/branch');
const { checkIfConfigured } = require('../configured');

const { checkBaseBranch } = require('./base');
const { mergeRenovateJson } = require('./config');

async function initRepo(input) {
  let config = { ...input, errors: [], warnings: [] };
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateJson(config);
  checkIfConfigured(config);
  await checkBaseBranch(config);
  return config;
}

module.exports = {
  initRepo,
};
