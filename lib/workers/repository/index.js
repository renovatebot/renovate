const { initRepo } = require('./init');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { handleError } = require('./error');
const { processResult } = require('./result');
const { processRepo } = require('./process');
const { finaliseRepo } = require('./finalise');

module.exports = {
  renovateRepository,
};

function sortBranches(branches) {
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
}

async function extractAndUpdate(config) {
  const deps = await extractDependencies(config);
  logger.debug({ deps }, 'deps');
  await fetchUpdates(config, deps);
  logger.debug({ deps }, 'deps with updates');
  const { branches, branchList } = branchifyUpgrades(config, deps);
  sortBranches(branches);
  let res;
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, deps, branches);
  }
  return { res, branches, branchList };
}

async function renovateRepository(repoConfig) {
  let config = { ...repoConfig };
  logger.setMeta({ repository: config.repository });
  logger.info('Renovating repository');
  logger.trace({ config }, 'renovateRepository()');
  try {
    config = await initRepo(config);
    let res;
    let branches;
    let branchList;
    let packageFiles;
    ({ res, branches, branchList, packageFiles } = await processRepo(config)); // eslint-disable-line prefer-const
    if (!config.repoIsOnboarded) {
      res = await ensureOnboardingPr(config, packageFiles, branches);
    }
    await finaliseRepo(config, branchList);
    return processResult(config, res);
  } catch (err) /* istanbul ignore next */ {
    return processResult(config, await handleError(config, err));
  } finally {
    logger.info('Finished repository');
  }
}
