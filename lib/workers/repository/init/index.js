const { checkOnboardingBranch } = require('../onboarding/branch');
const { checkIfConfigured } = require('../configured');

const { checkBaseBranch } = require('./base');
const { mergeRenovateJson } = require('./config');
const { initApis } = require('./apis');

async function initRepo(input, token) {
  let config = { ...input, errors: [], warnings: [] };
  config = await initApis(config, token);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateJson(config);
  checkIfConfigured(config);
  await checkBaseBranch(config);
  return config;
}

module.exports = {
  initRepo,
};
