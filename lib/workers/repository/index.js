const { initApis } = require('./init/apis');
const { initRepo } = require('./init');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { writeUpdates } = require('./write');
const { handleError } = require('./error');
const { pruneStaleBranches } = require('./cleanup');
const { validatePrs } = require('./validate');
const { branchifyUpgrades } = require('./updates/branchify');
const { filterConfig } = require('../../config');

const { extractDependencies, fetchUpdates } = require('../../manager');

module.exports = {
  renovateRepository,
};

async function renovateRepository(repoConfig) {
  let config = { ...repoConfig, branchList: [] };
  config.global = config.global || {};
  logger.setMeta({ repository: config.repository });
  logger.info('Renovating repository');
  logger.trace({ config }, 'renovateRepository()');
  let res;
  let branches;
  try {
    config = await initApis(config);
    config = await initRepo(config);
    const deps = await extractDependencies(config);
    logger.debug({ deps }, 'deps');
    await fetchUpdates(config, deps);
    logger.debug({ deps }, 'deps with updates');
    ({ branches } = branchifyUpgrades(config, deps));
    config = filterConfig(config, 'branch');
    await platform.ensureIssueClosing(
      'Action Required: Fix Renovate Configuration'
    );
    // Sort branches
    const sortOrder = [
      'pin',
      'digest',
      'patch',
      'minor',
      'major',
      'lockFileMaintenance',
    ];
    logger.debug({ branches }, 'branches');
    branches.sort((a, b) => {
      const sortDiff = sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type);
      if (sortDiff !== 0) {
        return sortDiff;
      }
      // Sort by prTitle if type is the same
      return a.prTitle < b.prTitle ? -1 : 1;
    });
    res = config.repoIsOnboarded
      ? await writeUpdates(config, deps, branches)
      : await ensureOnboardingPr(config, deps, branches);
  } catch (err) /* istanbul ignore next */ {
    res = await handleError(config, err);
  }
  logger.setMeta({ repository: config.repository });
  try {
    await validatePrs(config);
    await pruneStaleBranches(config, branches);
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
  let status;
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
