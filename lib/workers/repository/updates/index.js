const { determineRepoUpgrades } = require('./determine');
const { branchifyUpgrades } = require('./branchify');

module.exports = {
  determineUpdates,
};

async function determineUpdates(input) {
  let config = { ...input };
  const { logger } = config;
  logger.debug('determineUpdates()');
  logger.trace({ config });
  config = await determineRepoUpgrades(config);
  config = branchifyUpgrades(config);
  return config;
}
