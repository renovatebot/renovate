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
  config.errors = [];
  config.warnings = [];
  config.logger.trace({ config }, 'renovateRepository');
  try {
    config = await apis.initApis(config, token);
    config = await apis.mergeRenovateJson(config);
    if (config.enabled === false) {
      config.logger.debug('repository is disabled');
      await cleanup.pruneStaleBranches(config, []);
      return;
    }
    if (config.isFork && !config.renovateJsonPresent) {
      config.logger.debug('repository is a fork and not manually configured');
      return;
    }
    if (config.baseBranch) {
      // Renovate should read content and target PRs here
      if (await config.api.branchExists(config.baseBranch)) {
        config.api.setBaseBranch(config.baseBranch);
      } else {
        // Warn and ignore setting (use default branch)
        const message = `The configured baseBranch "${config.baseBranch}" is not present. Ignoring`;
        config.errors.push({
          depName: 'baseBranch',
          message,
        });
        config.logger.warn(message);
      }
    }
    // Detect package files in default branch if not manually provisioned
    if (config.packageFiles.length === 0) {
      config.logger.debug('Detecting package files');
      config = await apis.detectPackageFiles(config);
      // If we can't detect any package.json then return
      if (config.packageFiles.length === 0) {
        config.logger.info('Cannot detect package.json');
        return;
      }
      config.logger.debug(
        `Detected ${config.packageFiles
          .length} package files: ${config.packageFiles}`
      );
    }
    config = await apis.resolvePackageFiles(config);
    config.logger.trace({ config }, 'post-packageFiles config');
    config.repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!config.repoIsOnboarded) {
      config.contentBaseBranch = `${config.branchPrefix}configure`;
      // Remove packageFile list in case they are provisioned in renovate.json
      const packageFiles = config.packageFiles.map(
        packageFile => packageFile.packageFile
      );
      config.packageFiles = [];
      config = await apis.mergeRenovateJson(config, config.contentBaseBranch);
      // Restore previous packageFile list if not provisioned manually
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
      config = await apis.resolvePackageFiles(config);
      config.logger.trace({ config }, 'onboarding config');
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
      branchList = [`${config.branchPrefix}configure`];
    }
    await cleanup.pruneStaleBranches(config, branchList);
  } catch (err) {
    // Swallow this error so that other repositories can be processed
    if (err.message === 'uninitiated') {
      repoConfig.logger.info('Repository is unitiated - skipping');
    } else {
      repoConfig.logger.error(`Failed to process repository: ${err.message}`);
      repoConfig.logger.debug({ err });
    }
  }
}
