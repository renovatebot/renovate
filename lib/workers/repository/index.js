const convertHrTime = require('convert-hrtime');
const tmp = require('tmp');
const presets = require('../../config/presets');
// Workers
const branchWorker = require('../branch');
// children
const apis = require('./apis');
const onboarding = require('./onboarding');
const upgrades = require('./upgrades');
const cleanup = require('./cleanup');
const { decryptConfig } = require('../../config/decrypt');

module.exports = {
  pinDependenciesFirst,
  renovateRepository,
};

function pinDependenciesFirst(a, b) {
  if (a.type === 'pin') {
    return false;
  }
  if (b.type === 'pin') {
    return true;
  }
  return a.branchName > b.branchName;
}

async function renovateRepository(repoConfig, token) {
  let config = { ...repoConfig };
  const { logger } = config;
  config.tmpDir = tmp.dirSync({ unsafeCleanup: true });
  config.errors = [];
  config.warnings = [];
  logger.trace({ config }, 'renovateRepository');
  try {
    let branchList;
    let baseBranchUpdated;
    let loopCount = 1;
    do {
      logger.debug(`renovateRepository loop ${loopCount}`);
      baseBranchUpdated = false;
      config = await apis.initApis(config, token);
      config = await apis.mergeRenovateJson(config);
      if (config.enabled === false) {
        logger.debug('repository is disabled');
        await cleanup.pruneStaleBranches(config, []);
        return;
      }
      if (config.isFork && !config.renovateJsonPresent) {
        logger.debug('repository is a fork and not manually configured');
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
          logger.warn(message);
        }
      }
      // Detect package files in default branch if not manually provisioned
      if (config.packageFiles.length === 0) {
        logger.debug('Detecting package files');
        config = await apis.detectPackageFiles(config);
        // If we can't detect any package.json then return
        if (config.packageFiles.length === 0) {
          logger.info('Cannot detect package files');
          return;
        }
        logger.debug(
          `Detected ${config.packageFiles
            .length} package files: ${config.packageFiles}`
        );
      }
      logger.debug('Resolving package files and content');
      config = await apis.resolvePackageFiles(config);
      config = await apis.checkMonorepos(config);
      logger.trace({ config }, 'post-packageFiles config');
      // TODO: why is this fix needed?!
      config.logger = logger;
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
            logger.warn(message);
          }
        }
        config = await apis.resolvePackageFiles(config);
        config = await apis.checkMonorepos(config);
        config = await presets.resolveConfigPresets(config);
        config.logger = logger;
        logger.trace({ config }, 'onboarding config');
      }
      config = decryptConfig(config);
      logger.trace({ config }, 'post-decrypt config');
      const allUpgrades = await upgrades.determineRepoUpgrades(config);
      const res = await upgrades.branchifyUpgrades(allUpgrades, logger);
      config.errors = config.errors.concat(res.errors);
      config.warnings = config.warnings.concat(res.warnings);
      const branchUpgrades = res.upgrades;
      logger.debug(`Updating ${branchUpgrades.length} branch(es)`);
      logger.trace({ config: branchUpgrades }, 'branchUpgrades');
      if (config.repoIsOnboarded) {
        logger.info(`Processing ${branchUpgrades.length} branch(es)`);
        // eslint-disable-next-line no-loop-function
        branchUpgrades.sort(pinDependenciesFirst);
        const branchStartTime = process.hrtime();
        for (const branchUpgrade of branchUpgrades) {
          const branchResult = await branchWorker.processBranch(
            branchUpgrade,
            config.errors,
            config.warnings
          );
          if (branchResult === 'automerged') {
            // Stop procesing other branches because base branch has been changed by an automerge
            logger.info('Restarting repo renovation after automerge');
            baseBranchUpdated = true;
            break;
          } else if (branchResult === 'lockFileError') {
            logger.info('Lock file error - stopping branch updates');
            break;
          } else if (branchUpgrade.type === 'pin') {
            logger.info(
              'Stopping branch processing until Pin Dependencies is merged'
            );
            break;
          }
        }
        logger.info(
          { seconds: convertHrTime(process.hrtime(branchStartTime)).seconds },
          'Finished updating branches'
        );
        branchList = branchUpgrades.map(upgrade => upgrade.branchName);
        logger.debug(`branchList=${branchList}`);
      } else {
        await onboarding.ensurePr(config, branchUpgrades);
        logger.info('"Configure Renovate" PR needs to be closed first');
        branchList = [`${config.branchPrefix}configure`];
      }
      loopCount += 1;
    } while (baseBranchUpdated);
    await cleanup.pruneStaleBranches(config, branchList);
  } catch (err) {
    // Swallow this error so that other repositories can be processed
    if (err.message === 'uninitiated') {
      logger.info('Repository is uninitiated - skipping');
    } else {
      logger.error(`Failed to process repository: ${err.message}`);
      logger.debug({ err });
    }
  }
  config.tmpDir.removeCallback();
}
