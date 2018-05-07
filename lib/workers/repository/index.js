const { initRepo } = require('./init');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { handleError } = require('./error');
const { processResult } = require('./result');
const { processRepo } = require('./process');
const { finaliseRepo } = require('./finalise');

module.exports = {
  renovateRepository,
};

async function renovateRepository(repoConfig) {
  let config = { ...repoConfig };
  logger.info('Renovating repository: ' + config.repository);
  logger.trace({ config }, 'renovateRepository()');
  try {
    config = await initRepo(config);
    let res;
    let branches;
    let branchList;
    ({ res, branches, branchList } = await processRepo(config)); // eslint-disable-line prefer-const
    if (!config.repoIsOnboarded) {
      res = await ensureOnboardingPr(config, branches);
    }
    await finaliseRepo(config, branchList);
    return processResult(config, res);
  } catch (err) /* istanbul ignore next */ {
    return processResult(config, await handleError(config, err));
  } finally {
    logger.info('Finished repository');
  }
}
