const { checkOnboardingBranch } = require('../onboarding/branch');
const { checkIfConfigured } = require('../configured');
const { initApis } = require('../init/apis');
const { checkBaseBranch } = require('./base');
const { mergeRenovateConfig } = require('./config');
const { detectSemanticCommits } = require('./semantic');
const { detectVulnerabilityAlerts } = require('./vulnerability');

async function initRepo(input) {
  global.repoCache = {};
  let config = {
    ...input,
    errors: [],
    warnings: [],
    branchList: [],
  };
  config.global = config.global || {};
  config = await initApis(config);
  config.semanticCommits = await detectSemanticCommits(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  checkIfConfigured(config);
  config = await checkBaseBranch(config);
  await platform.setBranchPrefix(config.branchPrefix);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.info({ config }, 'Full resolved config including presets');
  }
  return config;
}

module.exports = {
  initRepo,
};
