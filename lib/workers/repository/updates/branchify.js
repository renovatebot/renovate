const handlebars = require('handlebars');

const { generateBranchConfig } = require('./generate');

function branchifyUpgrades(config) {
  logger.debug('branchifyUpgrades');
  logger.trace({ config });
  const errors = [];
  const warnings = [];
  const branchUpgrades = {};
  const branches = [];
  for (const upg of config.upgrades) {
    const upgrade = { ...upg };
    // Split out errors and wrnings first
    if (upgrade.type === 'error') {
      errors.push(upgrade);
    } else if (upgrade.type === 'warning') {
      warnings.push(upgrade);
    } else {
      // Check whether to use a group name
      let branchName;
      if (upgrade.groupName) {
        logger.debug('Using group branchName template');
        logger.debug(
          `Dependency ${upgrade.depName} is part of group ${upgrade.groupName}`
        );
        upgrade.groupSlug =
          upgrade.groupSlug ||
          upgrade.groupName
            .toString()
            .toLowerCase()
            .replace(/[^a-z0-9+]+/g, '-');
        branchName = handlebars.compile(upgrade.group.branchName)(upgrade);
      } else {
        logger.debug('Using regular branchName template');
        branchName = handlebars.compile(upgrade.branchName)(upgrade);
      }
      branchUpgrades[branchName] = branchUpgrades[branchName] || [];
      branchUpgrades[branchName] = [upgrade].concat(branchUpgrades[branchName]);
    }
  }
  logger.debug(`Returning ${Object.keys(branchUpgrades).length} branch(es)`);
  for (const branchName of Object.keys(branchUpgrades)) {
    logger.setMeta({
      repository: config.repository,
      branch: branchName,
    });
    const branch = generateBranchConfig(branchUpgrades[branchName]);
    branch.branchName = branchName;
    branches.push(branch);
  }
  logger.setMeta({
    repository: config.repository,
  });
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  const branchList = config.repoIsOnboarded
    ? branches.map(upgrade => upgrade.branchName)
    : config.branchList;
  return {
    ...config,
    errors: config.errors.concat(errors),
    warnings: config.warnings.concat(warnings),
    branches,
    branchList,
    upgrades: null,
  };
}

module.exports = {
  branchifyUpgrades,
};
