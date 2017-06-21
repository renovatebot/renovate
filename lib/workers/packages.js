// Global requires
const handlebars = require('handlebars');
// Logger
const logger = require('../helpers/logger');
// Sibling workers
const prWorker = require('./pr');
const branchWorker = require('./branch');

module.exports = {
  processUpgrades,
  updateBranch,
  removeStandaloneBranches,
};

async function processUpgrades(upgrades) {
  if (upgrades.length) {
    const upgradeCount = upgrades.length === 1
      ? '1 dependency upgrade'
      : `${upgrades.length} dependency upgrades`;
    logger.info(`Processing ${upgradeCount}`);
  } else {
    logger.info('No upgrades to process');
  }
  logger.debug({ config: upgrades }, 'All upgrades');
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
      logger.debug(
        `Dependency ${flattened.depName} is part of group '${flattened.groupName}'`
      );
      flattened.groupSlug =
        flattened.groupSlug ||
        flattened.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      branchName = handlebars.compile(flattened.groupBranchName)(flattened);
      logger.debug(`branchName=${branchName}`);
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
  logger.debug({ config: branchUpgrades }, 'Branched upgrades');
  for (const branch of Object.keys(branchUpgrades)) {
    await module.exports.removeStandaloneBranches(branchUpgrades[branch]);
    await module.exports.updateBranch(branchUpgrades[branch]);
  }
}

async function removeStandaloneBranches(upgrades) {
  if (upgrades.length > 1) {
    for (const upgrade of upgrades) {
      const standaloneBranchName = handlebars.compile(upgrade.branchName)(
        upgrade
      );
      logger.debug(`Need to delete branch ${standaloneBranchName}`);
      try {
        await upgrade.api.deleteBranch(standaloneBranchName);
      } catch (err) {
        logger.debug(`Couldn't delete branch ${standaloneBranchName}`);
      }
      // Rename to group branchName
      upgrade.branchName = upgrade.groupBranchName;
    }
  }
}

async function updateBranch(upgrades) {
  // Use templates to generate strings
  const upgrade0 = upgrades[0];
  const branchName = handlebars.compile(upgrade0.branchName)(upgrade0);
  const prTitle = handlebars.compile(upgrade0.prTitle)(upgrade0);

  const upgradeCount = upgrades.length === 1
    ? '1 upgrade'
    : `${upgrades.length} upgrades`;
  logger.info(
    `Branch '${branchName}' has ${upgradeCount}: ${upgrades.map(
      upgrade => upgrade.depName
    )}`
  );

  try {
    if (
      upgrade0.upgradeType !== 'maintainYarnLock' &&
      upgrade0.groupName === null &&
      !upgrade0.recreateClosed &&
      (await upgrade0.api.checkForClosedPr(branchName, prTitle))
    ) {
      logger.info(
        `Skipping ${branchName} upgrade as matching closed PR already existed`
      );
      return;
    }
    const branchCreated = await branchWorker.ensureBranch(upgrades);
    if (branchCreated) {
      const pr = await prWorker.ensurePr(upgrades);
      if (pr) {
        await prWorker.checkAutoMerge(pr, upgrade0);
      }
    }
  } catch (error) {
    logger.error(`Error updating branch ${branchName}: ${error}`);
    // Don't throw here - we don't want to stop the other renovations
  }
}
