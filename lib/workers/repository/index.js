const { initApis } = require('./init/apis');
const { initRepo } = require('./init');
const { determineUpdates } = require('./updates');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { writeUpdates } = require('./write');
const { handleError } = require('./error');
const { pruneStaleBranches } = require('./cleanup');

const { resolvePackageFiles } = require('../../manager/resolve');

module.exports = {
  renovateRepository,
};

async function renovateRepository(repoConfig, token, loop = 1) {
  let config = { ...repoConfig, branchList: [] };
  logger.setMeta({ repository: config.repository });
  logger.info('Renovating repository');
  logger.trace({ config, loop }, 'renovateRepository()');
  try {
    if (loop > 5) {
      throw new Error('loops>5');
    }
    config = await initApis(config, token);
    config = await initRepo(config);
    config = await resolvePackageFiles(config);
    config = await determineUpdates(config);
    const res = config.repoIsOnboarded
      ? await writeUpdates(config)
      : await ensureOnboardingPr(config);
    if (res === 'automerged') {
      logger.info('Restarting repo renovation after automerge');
      return renovateRepository(repoConfig, token, loop + 1);
    }
    return res;
  } catch (err) {
    return handleError(config, err);
  } finally {
    logger.setMeta({ repository: config.repository });
    await pruneStaleBranches(config);
    logger.info('Finished repository');
  }
}
