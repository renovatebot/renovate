const { checkOnboardingBranch } = require('../onboarding/branch');
const { checkIfConfigured } = require('../configured');
const { initApis } = require('../init/apis');
const { checkBaseBranch } = require('./base');
const { mergeRenovateConfig } = require('./config');
const { detectSemanticCommits } = require('./semantic');

async function initRepo(input) {
  let config = {
    ...input,
    errors: [],
    warnings: [],
    branchList: [],
  };
  config.global = config.global || {};
  config = await initApis(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  checkIfConfigured(config);
  config = await checkBaseBranch(config);
  config.semanticCommits = await detectSemanticCommits(config);
  await platform.getVulnerabilityAlerts();
  return config;
}

module.exports = {
  initRepo,
};
