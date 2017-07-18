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
  let config = Object.assign({}, repoConfig);
  config.errors = [];
  config.warnings = [];
  config.logger.trace({ config }, 'renovateRepository');
  try {
    config = await apis.initApis(config, token);
    config = await apis.mergeRenovateJson(config);
    if (config.enabled === false) {
      config.logger.debug('repository is disabled');
      return;
    }
    if (config.baseBranch) {
      if (await config.api.branchExists(config.baseBranch)) {
        await config.api.setBaseBranch(config.baseBranch);
      } else {
        const message = `The configured baseBranch "${config.baseBranch}" is not present. Ignoring`;
        config.errors.push({
          depName: 'baseBranch',
          message,
        });
        config.logger.warn(message);
      }
    }
    if (config.packageFiles.length === 0) {
      config.logger.debug('Detecting package files');
      config = await apis.detectPackageFiles(config);
      if (config.packageFiles.length === 0) {
        if (!config.hasRenovateJson) {
          config.logger.debug('Checking if repository has a package.json');
          const pJson = await config.api.getFileJson('package.json');
          if (!pJson) {
            config.logger.info('Repository has no package.json');
            return;
          }
        }
        config.packageFiles.push('package.json');
      }
    }
    config.repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!config.repoIsOnboarded) {
      config.contentBaseBranch = 'renovate/configure';
      const packageFiles = config.packageFiles;
      config = await apis.mergeRenovateJson(config, 'renovate/configure');
      if (config.packageFiles.length === 0) {
        config.packageFiles = packageFiles;
      }
      if (config.baseBranch) {
        if (await config.api.branchExists(config.baseBranch)) {
          config.contentBaseBranch = config.baseBranch;
        } else {
          const message = `The configured baseBranch "${config.baseBranch}" is not present. Ignoring`;
          config.errors.push({
            depName: 'baseBranch',
            message,
          });
          config.logger.warn(message);
        }
      }
    }
    const allUpgrades = await upgrades.determineRepoUpgrades(config);
    const res = await upgrades.branchifyUpgrades(allUpgrades, config.logger);
    config.errors = config.errors.concat(res.errors);
    config.warnings = config.warnings.concat(res.warnings);
    const branchUpgrades = res.upgrades;
    config.logger.debug(`Updating ${branchUpgrades.length} branch(es)`);
    config.logger.trace({ config: branchUpgrades }, 'branchUpgrades');
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
      config.logger.debug(`branchList=${branchList}`);
    } else {
      await onboarding.ensurePr(config, branchUpgrades);
      config.logger.info('"Configure Renovate" PR needs to be closed first');
      branchList = ['renovate/configure'];
    }
    await cleanup.pruneStaleBranches(config, branchList);
  } catch (err) {
    console.log(JSON.stringify(err));
    // Swallow this error so that other repositories can be processed
    if (err.message === 'uninitiated') {
      config.logger.info('Repository is unitiated - skipping');
    } else {
      config.logger.error(`Failed to process repository: ${err.message}`);
      config.logger.debug({ err });
    }
  }
}
