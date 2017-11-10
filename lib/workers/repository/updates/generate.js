const handlebars = require('handlebars');

function generateBranchConfig(branchUpgrades) {
  const config = {
    upgrades: [],
  };
  const hasGroupName = branchUpgrades[0].groupName !== null;
  logger.debug(`hasGroupName: ${hasGroupName}`);
  // Use group settings only if multiple upgrades or lazy grouping is disabled
  const depNames = [];
  branchUpgrades.forEach(upg => {
    if (!depNames.includes(upg.depName)) {
      depNames.push(upg.depName);
    }
  });
  const groupEligible =
    depNames.length > 1 || branchUpgrades[0].lazyGrouping === false;
  logger.debug(`groupEligible: ${groupEligible}`);
  const useGroupSettings = hasGroupName && groupEligible;
  logger.debug(`useGroupSettings: ${useGroupSettings}`);
  for (const branchUpgrade of branchUpgrades) {
    const upgrade = { ...branchUpgrade };
    if (useGroupSettings) {
      // Now overwrite original config with group config
      Object.assign(upgrade, upgrade.group);
    } else {
      delete upgrade.groupName;
    }
    // Delete group config regardless of whether it was applied
    delete upgrade.group;
    delete upgrade.lazyGrouping;
    // Use templates to generate strings
    logger.debug(
      { branchName: upgrade.branchName, prTitle: upgrade.prTitle },
      'Compiling branchName and prTitle'
    );
    upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
    upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
    if (upgrade.semanticCommits) {
      logger.debug('Upgrade has semantic commits enabled');
      upgrade.prTitle = `${
        upgrade.semanticPrefix
      } ${upgrade.prTitle.toLowerCase()}`;
    }
    logger.debug(`${upgrade.branchName}, ${upgrade.prTitle}`);
    config.upgrades.push(upgrade);
  }
  // Now assign first upgrade's config as branch config
  return { ...config, ...config.upgrades[0] };
}

module.exports = {
  generateBranchConfig,
};
