const { initApis } = require('./init/apis');
const { initRepo } = require('./init');
const { determineUpdates } = require('./updates');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { writeUpdates } = require('./write');
const { handleError } = require('./error');
const { pruneStaleBranches } = require('./cleanup');
const { validatePrs } = require('./validate');

const { extractDependencies } = require('../../manager');

module.exports = {
  renovateRepository,
};

async function renovateRepository(repoConfig) {
  let config = { ...repoConfig, branchList: [] };
  config.global = config.global || {};
  logger.setMeta({ repository: config.repository });
  logger.info('Renovating repository');
  logger.trace({ config }, 'renovateRepository()');
  let commonConfig;
  let res;
  let status;
  try {
    config = await initApis(config);
    config = await initRepo(config);
    if (config.baseBranches && config.baseBranches.length) {
      // At this point we know if we have multiple branches
      // Do the following for every branch
      commonConfig = JSON.parse(JSON.stringify(config));
      const configs = [];
      logger.info({ baseBranches: config.baseBranches }, 'baseBranches');
      for (const [index, baseBranch] of commonConfig.baseBranches.entries()) {
        config = JSON.parse(JSON.stringify(commonConfig));
        config.baseBranch = baseBranch;
        config.branchPrefix +=
          config.baseBranches.length > 1 ? `${baseBranch}-` : '';
        platform.setBaseBranch(baseBranch);
        config = await extractDependencies(config);
        config = await determineUpdates(config);
        configs[index] = config;
      }
      // Combine all the results into one
      for (const [index, entry] of configs.entries()) {
        if (index === 0) {
          config = entry;
        } else {
          config.branches = config.branches.concat(entry.branches);
        }
      }
      // istanbul ignore next
      config.branchList = config.branches.map(branch => branch.branchName);
    } else {
      config = await extractDependencies(config);
      config = await determineUpdates(config);
    }

    // Sort branches
    const sortOrder = [
      'pin',
      'digest',
      'patch',
      'minor',
      'major',
      'lockFileMaintenance',
    ];
    config.branches.sort((a, b) => {
      const sortDiff = sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type);
      if (sortDiff !== 0) {
        // type is different
        return sortDiff;
      }
      // Sort by prTitle
      return a.prTitle < b.prTitle ? -1 : 1;
    });
    res = config.repoIsOnboarded
      ? await writeUpdates(config)
      : await ensureOnboardingPr(config);
    await validatePrs(commonConfig || config);
  } catch (err) /* istanbul ignore next */ {
    res = await handleError(config, err);
  }
  logger.setMeta({ repository: config.repository });
  config.branchPrefix = commonConfig
    ? commonConfig.branchPrefix
    : config.branchPrefix;
  try {
    await pruneStaleBranches(config);
    platform.cleanRepo();
  } catch (err) /* istanbul ignore next */ {
    logger.error(
      { err, message: err.message },
      'Error pruning/cleaning repository'
    );
  }
  const disabledStatuses = [
    'archived',
    'blocked',
    'disabled',
    'forbidden',
    'fork',
    'no-package-files',
    'not-found',
    'renamed',
    'uninitiated',
  ];
  const errorStatuses = [
    'config-validation',
    'error',
    'unknown-error',
    'not-found',
  ];
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
  } else if (errorStatuses.includes(res)) {
    status = 'error';
  } else if (config.repoIsOnboarded) {
    status = 'enabled';
  } else {
    status = 'onboarding';
    if (res === 'onboarding') {
      res = 'done';
    }
  }
  logger.info('Finished repository');
  return { res, status };
}
