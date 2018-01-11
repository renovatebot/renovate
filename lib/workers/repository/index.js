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

    if (config.baseBranches.length) {
      // At this point we know if we have multiple branches
      // Do the following for every branch
      const commonConfig = JSON.parse(JSON.stringify(config));
      const configs = [];
      logger.info({ baseBranches: config.baseBranches }, 'baseBranches');
      for (const [index, baseBranch] of commonConfig.baseBranches.entries()) {
        config = JSON.parse(JSON.stringify(commonConfig));
        config.baseBranch = baseBranch;
        config.baseBranchPrefix = baseBranch + '-';
        platform.setBaseBranch(baseBranch);
        config = await resolvePackageFiles(config);
        config = await determineUpdates(config);
        configs[index] = config;
      }
      // Combine all the results into one
      for (const [index, res] of configs.entries()) {
        if (index === 0) {
          config = res;
        } else {
          config.branches = config.branches.concat(res.branches);
        }
      }
    } else {
      config = await resolvePackageFiles(config);
      config = await determineUpdates(config);
    }

    // Sort branches
    const sortOrder = [
      'digest',
      'pin',
      'patch',
      'minor',
      'major',
      'lockFileMaintenance',
    ];
    config.branches.sort(
      (a, b) => sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type)
    );
    const res = config.repoIsOnboarded
      ? await writeUpdates(config)
      : await ensureOnboardingPr(config);
    if (res === 'pr-closed' || res === 'automerged') {
      logger.info(`Restarting repo renovation after ${res}`);
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
