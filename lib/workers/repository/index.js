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
