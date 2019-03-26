const fs = require('fs-extra');

const { logger } = require('../../logger');
const { initRepo } = require('./init');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { handleError } = require('./error');
const { processResult } = require('./result');
const { processRepo } = require('./process');
const { finaliseRepo } = require('./finalise');
const { ensureMasterIssue } = require('./master-issue');

module.exports = {
  renovateRepository,
};

// istanbul ignore next
async function renovateRepository(repoConfig) {
  let config = { ...repoConfig };
  const repositoryLogger = logger.child({ repository: config.repository });
  repositoryLogger.info('Renovating repository');
  repositoryLogger.trace({ config });
  let repoResult;
  try {
    await fs.ensureDir(config.localDir);
    repositoryLogger.debug('Using localDir: ' + config.localDir);
    config = await initRepo(config);
    const { res, branches, branchList, packageFiles } = await processRepo(
      config
    );
    await ensureOnboardingPr(config, packageFiles, branches);
    await ensureMasterIssue(config, branches);
    await finaliseRepo(config, branchList);
    repoResult = processResult(config, res);
  } catch (err) /* istanbul ignore next */ {
    const errorRes = await handleError(config, err);
    repoResult = processResult(config, errorRes);
  }
  await platform.cleanRepo();
  if (config.localDir && !config.persistRepoData) {
    await fs.remove(config.localDir);
  }
  repositoryLogger.info('Finished repository');
  return repoResult;
}
