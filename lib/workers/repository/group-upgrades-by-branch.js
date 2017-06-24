// Global requires
const handlebars = require('handlebars');

module.exports = groupUpgradesByBranch;

async function groupUpgradesByBranch(upgrades, config) {
  config.logger.trace({ config: upgrades }, 'groupUpgradesByBranch');
  if (upgrades.length === 0) {
    config.logger.info('No upgrades to process');
    return {};
  }
  config.logger.info(`Processing ${upgrades.length} dependency upgrade(s)`);
  const branchUpgrades = {};
  for (const upg of upgrades) {
    const upgrade = Object.assign({}, upg);
    if (upgrade.upgradeType === 'pin') {
      upgrade.isPin = true;
    } else if (upgrade.upgradeType === 'major') {
      upgrade.isMajor = true;
    } else if (upgrade.upgradeType === 'minor') {
      upgrade.isMinor = true;
    }
    // Check whether to use a group name
    let branchName;
    if (upgrade.groupName) {
      branchName = handlebars.compile(upgrade.groupBranchName)(upgrade);
      upgrade.groupSlug =
        upgrade.groupSlug ||
        upgrade.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      config.logger.debug(
        { branchName },
        `Dependency ${upgrade.depName} is part of group '${upgrade.groupName}'`
      );
      if (branchUpgrades[branchName]) {
        // upgrade.branchName = upgrade.groupBranchName;
        upgrade.commitMessage = upgrade.groupCommitMessage;
        upgrade.prTitle = upgrade.groupPrTitle;
        upgrade.prBody = upgrade.groupPrBody;
      }
    } else {
      branchName = handlebars.compile(upgrade.branchName)(upgrade);
    }
    branchUpgrades[branchName] = branchUpgrades[branchName] || [];
    branchUpgrades[branchName] = [upgrade].concat(branchUpgrades[branchName]);
  }
  config.logger.debug(
    `Returning ${Object.keys(branchUpgrades).length} branch(es)`
  );
  return branchUpgrades;
}
