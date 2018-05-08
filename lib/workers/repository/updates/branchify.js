const handlebars = require('handlebars');
const slugify = require('slugify');
const cleanGitRef = require('clean-git-ref').clean;

const { generateBranchConfig } = require('./generate');

/**
 * Clean git branch name
 *
 * Remove what clean-git-ref fails to:
 * - leading dot/leading dot after slash
 * - trailing dot
 * - whitespace
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
    const update = { ...upg };
    // Split out errors and warnings first
    if (update.type === 'error') {
      errors.push(update);
    } else if (update.type === 'warning') {
      warnings.push(update);
    } else {
      // Check whether to use a group name
      if (update.groupName) {
        logger.debug('Using group branchName template');
        logger.debug(
          `Dependency ${update.depName} is part of group ${update.groupName}`
        );
        update.groupSlug = slugify(update.groupSlug || update.groupName, {
          lower: true,
        });
        update.branchTopic = update.group.branchTopic || update.branchTopic;
        update.branchName = handlebars.compile(
          update.group.branchName || update.branchName
        )(update);
      } else {
        update.branchName = handlebars.compile(update.branchName)(update);
      }
      // Compile extra times in case of nested handlebars templates
      update.branchName = handlebars.compile(update.branchName)(update);
      update.branchName = cleanBranchName(
        handlebars.compile(update.branchName)(update)
      );

      branchUpgrades[update.branchName] =
        branchUpgrades[update.branchName] || [];
      branchUpgrades[update.branchName] = [update].concat(
        branchUpgrades[update.branchName]
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
