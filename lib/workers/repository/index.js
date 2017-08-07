// Workers
const branchWorker = require('../branch');
// children
const apis = require('./apis');
const onboarding = require('./onboarding');
const upgrades = require('./upgrades');
const cleanup = require('./cleanup');

module.exports = {
  renovateRepository,
};

async function renovateRepository(repoConfig, token) {
  let config = { ...repoConfig };
  const { api, logger } = config;
  config.errors = [];
  config.warnings = [];
  logger.trace({ config }, 'renovateRepository');
  try {
    config = await apis.initApis(config, token);
    config = await apis.mergeRenovateJson(config);
    if (config.enabled === false) {
      logger.debug('repository is disabled');
      await cleanup.pruneStaleBranches(config, []);
      return;
    }
    if (config.isFork && !config.renovateJsonPresent) {
      logger.debug('repository is a fork and not manually configured');
      await cleanup.pruneStaleBranches(config, []);
      return;
    }
    if (config.baseBranch) {
      if (await api.branchExists(config.baseBranch)) {
        await api.setBaseBranch(config.baseBranch);
      } else {
        const message = `The configured baseBranch "${config.baseBranch}" is not present. Ignoring`;
        config.errors.push({
          depName: 'baseBranch',
          message,
        });
        logger.warn(message);
      }
    }
    if (config.packageFiles.length === 0) {
      logger.debug('Detecting package files');
      config = await apis.detectPackageFiles(config);
      if (config.packageFiles.length === 0) {
        if (!config.hasRenovateJson) {
          logger.debug('Checking if repository has a package.json');
          const pJson = await api.getFileJson('package.json');
          if (!pJson) {
            logger.info('Repository has no package.json');
            return;
          }
        }
        config.packageFiles.push('package.json');
      }
    }
    config.repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!config.repoIsOnboarded) {
      config.contentBaseBranch = `${config.branchPrefix}configure`;
      const packageFiles = config.packageFiles;
      config = await apis.mergeRenovateJson(
        config,
        `${config.branchPrefix}configure`
      );
      if (config.packageFiles.length === 0) {
        config.packageFiles = packageFiles;
      }
      if (config.baseBranch) {
        if (await api.branchExists(config.baseBranch)) {
          config.contentBaseBranch = config.baseBranch;
        } else {
          const message = `The configured baseBranch "${config.baseBranch}" is not present. Ignoring`;
          config.errors.push({
            depName: 'baseBranch',
            message,
          });
          logger.warn(message);
        }
      }
    }
    const allUpgrades = await upgrades.determineRepoUpgrades(config);
    const res = await upgrades.branchifyUpgrades(allUpgrades, logger);
    config.errors = config.errors.concat(res.errors);
    config.warnings = config.warnings.concat(res.warnings);
    const branchUpgrades = res.upgrades;
    logger.debug(`Updating ${branchUpgrades.length} branch(es)`);
    logger.trace({ config: branchUpgrades }, 'branchUpgrades');
    let branchList;
    if (config.repoIsOnboarded) {
      for (const branchUpgrade of branchUpgrades) {
        await branchWorker.processBranchUpgrades(
          branchUpgrade,
          config.errors,
          config.warnings
        );
      }
      branchList = branchUpgrades.map(upgrade => upgrade.branchName);
      logger.debug(`branchList=${branchList}`);
    } else {
      await onboarding.ensurePr(config, branchUpgrades);
      logger.info('"Configure Renovate" PR needs to be closed first');
      branchList = [`${config.branchPrefix}configure`];
    }
    await cleanup.pruneStaleBranches(config, branchList);
  } catch (err) {
    // Swallow this error so that other repositories can be processed
    if (err.message === 'uninitiated') {
      logger.info('Repository is unitiated - skipping');
    } else {
      logger.error(`Failed to process repository: ${err.message}`);
      logger.debug({ err });
    }
  }
}
