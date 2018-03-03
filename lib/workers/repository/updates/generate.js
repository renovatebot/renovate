const handlebars = require('handlebars');

function generateBranchConfig(branchUpgrades) {
  logger.debug(`generateBranchConfig()`);
  logger.trace({ config: branchUpgrades });
  const config = {
    upgrades: [],
  };
  const hasGroupName = branchUpgrades[0].groupName !== null;
  logger.debug(`hasGroupName: ${hasGroupName}`);
  // Use group settings only if multiple upgrades or lazy grouping is disabled
  const depNames = [];
  const newVersion = [];
  branchUpgrades.forEach(upg => {
    if (!depNames.includes(upg.depName)) {
      depNames.push(upg.depName);
    }
    if (!newVersion.includes(upg.newVersion)) {
      newVersion.push(upg.newVersion);
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
    if (newVersion.length === 1) {
      [upgrade.singleVersion] = newVersion;
    } else {
      upgrade.recreateClosed = true;
    }
    // Use templates to generate strings
    logger.debug(
      { branchName: upgrade.branchName, prTitle: upgrade.prTitle },
      'Compiling branchName and prTitle'
    );
    upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
    upgrade.prTitle +=
      upgrade.baseBranches && upgrade.baseBranches.length > 1
        ? ' ({{baseBranch}})'
        : '';
    upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
    if (upgrade.semanticCommits) {
      logger.debug('Upgrade has semantic commits enabled');
      let semanticPrefix = upgrade.semanticCommitType;
      if (upgrade.semanticCommitScope) {
        semanticPrefix += `(${upgrade.semanticCommitScope})`;
      }
      upgrade.prTitle = `${semanticPrefix}: ${upgrade.prTitle.toLowerCase()}`;
    }
    logger.debug(`${upgrade.branchName}, ${upgrade.prTitle}`);
    config.upgrades.push(upgrade);
  }
  if (
    depNames.length === 2 &&
    !hasGroupName &&
    config.upgrades[0].depName.startsWith('@types/') &&
    config.upgrades[0].depName.endsWith(config.upgrades[1].depName)
  ) {
    logger.debug('Found @types - reversing upgrades to use depName in PR');
    config.upgrades.reverse();
    config.upgrades[0].recreateClosed = false;
    config.hasTypes = true;
  }
  // Now assign first upgrade's config as branch config
  return { ...config, ...config.upgrades[0] };
}

module.exports = {
  generateBranchConfig,
};
