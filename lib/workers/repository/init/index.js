const { checkOnboardingBranch } = require('../onboarding/branch');
const { checkIfConfigured } = require('../configured');
const { initApis } = require('../init/apis');
const { checkBaseBranch } = require('./base');
const { mergeRenovateConfig } = require('./config');

async function initRepo(input) {
  let config = {
    ...input,
    errors: [],
    warnings: [],
    branchList: [],
    global: {},
  };
  logger.setMeta({ repository: config.repository });
  config = await initApis(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  checkIfConfigured(config);
  config = await checkBaseBranch(config);
  return config;
}

module.exports = {
  initRepo,
};
