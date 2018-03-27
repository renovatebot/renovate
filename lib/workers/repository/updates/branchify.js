const handlebars = require('handlebars');
const slugify = require('slugify');
const cleanGitRef = require('clean-git-ref').clean;

const { generateBranchConfig } = require('./generate');

/**
 * Clean git branch name
 *
 * 1. Remove what clean-git-ref fails to:
 *   - leading dot
 *   - trailing dot
 *   - whitespace
 *
 * 2. Reslugify after stripping chars:
 *   - to prevent names like
 */
function cleanBranchName(branchName) {
  return cleanGitRef(branchName)
    .replace(/^\.|\.$/, '') // leading or trailing dot
    .replace(/\/\./g, '/') // leading dot after slash
    .replace(/\s/g, ''); // whitespace
}

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
      if (upgrade.groupName) {
        logger.debug('Using group branchName template');
        logger.debug(
          `Dependency ${upgrade.depName} is part of group ${upgrade.groupName}`
        );

        upgrade.groupSlug = slugify(upgrade.groupSlug || upgrade.groupName, {
          lower: true
        });
        upgrade.branchName = handlebars.compile(upgrade.group.branchName)(
          upgrade
        );
      } else {
        logger.debug('Using regular branchName template');
        upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
      }
      // Compile extra times in case of nested handlebars templates
      upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
      upgrade.branchName = cleanBranchName(
        handlebars.compile(upgrade.branchName)(upgrade)
      );

      branchUpgrades[upgrade.branchName] =
        branchUpgrades[upgrade.branchName] || [];
      branchUpgrades[upgrade.branchName] = [upgrade].concat(
        branchUpgrades[upgrade.branchName]
      );
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
