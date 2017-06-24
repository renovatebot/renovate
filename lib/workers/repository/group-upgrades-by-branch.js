// Global requires
const handlebars = require('handlebars');

module.exports = groupUpgradesByBranch;

async function groupUpgradesByBranch(upgrades, config) {
  config.logger.trace({ config: upgrades }, 'groupUpgradesByBranch');
  if (upgrades.length) {
    const upgradeCount = upgrades.length === 1
      ? '1 dependency upgrade'
      : `${upgrades.length} dependency upgrades`;
    config.logger.info(`Processing ${upgradeCount}`);
  } else {
    config.logger.info('No upgrades to process');
  }
  const branchUpgrades = {};
  for (const upgrade of upgrades) {
    const flattened = Object.assign({}, upgrade.config, upgrade);
    delete flattened.config;
    if (flattened.upgradeType === 'pin') {
      flattened.isPin = true;
    } else if (flattened.upgradeType === 'major') {
      flattened.isMajor = true;
    } else if (flattened.upgradeType === 'minor') {
      flattened.isMinor = true;
    }
    // Check whether to use a group name
    let branchName;
    if (flattened.groupName) {
      branchName = handlebars.compile(flattened.groupBranchName)(flattened);
      flattened.groupSlug =
        flattened.groupSlug ||
        flattened.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      config.logger.debug(
        { branchName },
        `Dependency ${flattened.depName} is part of group '${flattened.groupName}'`
      );
      if (branchUpgrades[branchName]) {
        // flattened.branchName = flattened.groupBranchName;
        flattened.commitMessage = flattened.groupCommitMessage;
        flattened.prTitle = flattened.groupPrTitle;
        flattened.prBody = flattened.groupPrBody;
      }
    } else {
      branchName = handlebars.compile(flattened.branchName)(flattened);
    }
    branchUpgrades[branchName] = branchUpgrades[branchName] || [];
    branchUpgrades[branchName] = [flattened].concat(branchUpgrades[branchName]);
  }
  config.logger.debug(
    `Returning ${Object.keys(branchUpgrades).length} branch(es)`
  );
  return branchUpgrades;
}
