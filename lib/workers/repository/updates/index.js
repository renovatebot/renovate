const { determineRepoUpgrades } = require('./determine');
const { branchifyUpgrades } = require('./branchify');

module.exports = {
  determineUpdates,
};

async function determineUpdates(input) {
  let config = { ...input };
  logger.debug('determineUpdates()');
  logger.trace({ config });
  config = await determineRepoUpgrades(config);
  platform.ensureIssueClosing('Action Required: Fix Renovate Configuration');
  config = branchifyUpgrades(config);
  logger.debug('Finished determining upgrades');
  return config;
}
