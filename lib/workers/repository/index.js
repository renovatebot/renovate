const convertHrTime = require('convert-hrtime');
const tmp = require('tmp-promise');
const manager = require('../../manager');
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
  logger.trace({ config }, 'renovateRepository');
  config.tmpDir = await tmp.dir({ unsafeCleanup: true });
  config.errors = [];
  config.warnings = [];
  async function renovateRepositoryInner(count = 1) {
    // istanbul ignore if
    if (count > 5) {
      // This is an arbitrary number added in to cut short any unintended infinite recursion
      throw new Error('Existing renovateRepositoryInner after 5 loops');
    }
    logger.info(`renovateRepository loop ${count}`);
    let branchList = [];
    config = await apis.initApis(config, token);
    config = await apis.mergeRenovateJson(config);
    if (config.enabled === false) {
      logger.debug('repository is disabled');
      await cleanup.pruneStaleBranches(config, []);
      return null;
    }
    if (config.isFork) {
      if (config.renovateJsonPresent) {
        logger.info('Processing forked repository');
      } else {
        logger.debug('repository is a fork and not manually configured');
        await cleanup.pruneStaleBranches(config, []);
        return null;
      }
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
    config = await onboarding.getOnboardingStatus(config);
    // Detect package files in default branch if not manually provisioned
    if (config.packageFiles.length === 0) {
      logger.debug('Detecting package files');
      config = await manager.detectPackageFiles(config);
      // If we can't detect any package.json then return
      if (config.packageFiles.length === 0) {
        logger.info('Cannot detect package files');
        // istanbul ignore if
        if (config.repoIsOnboarded === false) {
          logger.warn('Need to delete onboarding PR');
          const pr = await config.api.getBranchPr(config.onboardingBranch);
          if (pr) {
            logger.info('Found onboarding PR');
            await config.api.updatePr(
              pr.number,
              'Configure Renovate - canceled',
              'This PR was created in error and is now being deleted automatically. Sorry for the inconvenience.'
            );
            await config.api.deleteBranch(config.onboardingBranch);
            throw new Error('no package files');
          }
        }
        return null;
      }
      logger.info(
        {
          packageFiles: config.packageFiles,
          count: config.packageFiles.length,
        },
        `Detected package files`
      );
    }
    logger.debug('Resolving package files and content');
    config = await apis.resolvePackageFiles(config);
    config = await apis.checkMonorepos(config);
    logger.trace({ config }, 'post-packageFiles config');
    // TODO: why is this fix needed?!
    config.logger = logger;
    config = decryptConfig(config);
    logger.trace({ config }, 'post-decrypt config');
    const allUpgrades = await upgrades.determineRepoUpgrades(config);
    const res = await upgrades.branchifyUpgrades(allUpgrades, logger);
    config.errors = config.errors.concat(res.errors);
    config.warnings = config.warnings.concat(res.warnings);
    let branchUpgrades = res.upgrades.sort(pinDependenciesFirst);
    logger.debug(`Updating ${branchUpgrades.length} branch(es)`);
    logger.trace({ config: branchUpgrades }, 'branchUpgrades');
    if (config.repoIsOnboarded) {
      logger.info(`Processing ${branchUpgrades.length} branch(es)`);
      const branchStartTime = process.hrtime();
      branchList = branchUpgrades.map(upgrade => upgrade.branchName);
      if (branchUpgrades.length && branchUpgrades[0].isPin) {
        branchUpgrades = branchUpgrades.filter(upg => upg.isPin);
        logger.info(`Processing ${branchUpgrades.length} "pin" PRs first`);
      }
      for (const branchUpgrade of branchUpgrades) {
        const branchResult = await branchWorker.processBranch(
          branchUpgrade,
          config.errors,
          config.warnings
        );
        if (branchResult === 'automerged') {
          // Stop procesing other branches because base branch has been changed by an automerge
          logger.info('Restarting repo renovation after automerge');
          return renovateRepositoryInner(count + 1);
        }
      }
      logger.info(
        { seconds: convertHrTime(process.hrtime(branchStartTime)).seconds },
        'Finished updating branches'
      );
    } else {
      await onboarding.ensurePr(config, branchUpgrades);
      logger.info('"Configure Renovate" PR needs to be closed first');
      branchList = [`${config.branchPrefix}configure`];
    }
    logger.debug(`branchList=${branchList}`);
    return branchList;
  }
  try {
    const branchList = await renovateRepositoryInner();
    if (branchList) {
      await cleanup.pruneStaleBranches(config, branchList);
    }
  } catch (err) {
    // Swallow this error so that other repositories can be processed
    if (err.message === 'uninitiated') {
      logger.info('Repository is uninitiated - skipping');
    } else if (err.message === 'no package files') {
      logger.info('Repository has no package files - skipping');
    } else {
      logger.error(`Failed to process repository: ${err.message}`);
      logger.debug({ err });
    }
  }
  config.tmpDir.cleanup();
}
