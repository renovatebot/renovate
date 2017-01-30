const logger = require('winston');
const changelog = require('changelog');
const stringify = require('json-stringify-pretty-compact');
const github = require('./api/github');
const handlebars = require('./helpers/handlebars');
const versionsHelper = require('./helpers/versions');
const packageJson = require('./helpers/package-json');
const npmApi = require('./api/npm');

let config = null;

module.exports = renovate;

// This function manages the queue per-package file
function renovate(repoName, packageFile, setConfig) {
  // Initialize globals
  config = Object.assign({}, setConfig);
  config.packageFile = packageFile;

  logger.info(`Processing ${repoName} ${packageFile}`);

  let packageFileContents;

  // Start the chain
  return github.getFileJson(packageFile)
    .then((contents) => {
      packageFileContents = contents;
      return Promise.resolve();
    })
    .then(() => checkforRenovateConfig(packageFileContents))
    .then(checkIfEnabled)
    .then(() => packageJson.extractDependencies(packageFileContents, config.depTypes))
    .then(filterIgnoredDependencies)
    .then(findUpgrades)
    .then(processUpgradesSequentially)
    .then(() => { // eslint-disable-line promise/always-return
      logger.info(`${repoName} ${packageFile} done`);
    })
    .catch((error) => {
      if (error === 'renovate disabled') {
        logger.debug('Renovate disabled - skipping');
      } else if (error === 'Repository not configured') {
        logger.debug('Repository not configured - skipping');
      }
      logger.error(`renovate caught error: ${error}`);
    });
}

function checkforRenovateConfig(packageContent) {
  if (packageContent.renovate) {
    logger.debug(`package.json>renovate config: ${stringify(packageContent.renovate)}`);
    config = Object.assign(config, packageContent.renovate, { repoConfigured: true });
    logger.debug(`Updated config: ${JSON.stringify(config)}`);
  }
  return Promise.resolve();
}

// Rejects promise if config.enabled = false
function checkIfEnabled() {
  if (!config.enabled) {
    logger.info('Config is disabled. Skipping');
    return Promise.reject('renovate disabled');
  }
  return Promise.resolve();
}

// Remove any dependencies that are on the ignore list
function filterIgnoredDependencies(dependencies) {
  return dependencies.filter(dependency => config.ignoreDeps.indexOf(dependency.depName) === -1);
}

function findUpgrades(dependencies) {
  const allDependencyUpgrades = [];
  // We create an array of promises so that they can be executed in parallel
  const allDependencyPromises = dependencies.reduce((promises, dep) => promises.concat(
    npmApi.getDependency(dep.depName)
    .then(npmDependency =>
      versionsHelper.determineUpgrades(npmDependency, dep.currentVersion, config))
    .then((upgrades) => {
      if (upgrades.length > 0) {
        logger.verbose(`${dep.depName}: Upgrades = ${JSON.stringify(upgrades)}`);
        upgrades.forEach((upgrade) => {
          allDependencyUpgrades.push(Object.assign({}, dep, upgrade));
        });
      } else {
        logger.verbose(`${dep.depName}: No upgrades required`);
      }
      return Promise.resolve();
    })
    .catch((error) => {
      logger.error(`Error finding upgrades for ${dep.depName}: ${error}`);
    })), []);
  // Return the upgrade array once all Promises are complete
  return Promise.all(allDependencyPromises).then(() => allDependencyUpgrades);
}

function processUpgradesSequentially(upgrades) {
  if (Object.keys(upgrades).length) {
    logger.verbose('Processing upgrades');
  } else {
    logger.verbose('No upgrades to process');
  }
  logger.verbose(`All upgrades: ${JSON.stringify(upgrades)}`);
  // We are processing each upgrade sequentially for two major reasons:
  // 1. Reduce chances of GitHub API rate limiting
  // 2. Edge case collision of branch name, e.g. dependency also listed as dev dependency
  return upgrades.reduce(
    (promise, upgrade) => promise
      .then(() => updateDependency(upgrade)), Promise.resolve());
}

function updateDependency(upgrade) {
  // Expand upgrade params
  const depType = upgrade.depType;
  const depName = upgrade.depName;
  const newVersion = upgrade.newVersion;
  // Helpers for templating
  const params = Object.assign({}, upgrade);
  if (upgrade.upgradeType === 'pin') {
    params.isPin = true;
  } else if (upgrade.upgradeType === 'major') {
    params.isMajor = true;
  } else if (upgrade.upgradeType === 'minor') {
    params.isMinor = true;
  }
  // Use templates to generate strings
  const branchName = handlebars.transform(config.branchName, params);
  const commitMessage = handlebars.transform(config.commitMessage, params);
  const prTitle = handlebars.transform(config.prTitle, params);

  return checkForClosedPr()
  .then(ensureBranch)
  .then(getChangelog)
  .then(log => ensurePr(log))
  .catch((error) => {
    if (error === 'PR exists') {
      logger.verbose(`Skipping ${depName} upgrade as matching closed PR already existed`);
    } else {
      logger.error(`Error updating dependency ${depName}: ${error}`);
    }
    // Don't throw here - we don't want to stop the other renovations
  });

  // Check if same PR already existed and skip if so
  // This allows users to close an unwanted upgrade PR and not worry about seeing it raised again
  function checkForClosedPr() {
    if (config.recreateClosed) {
      logger.debug(`${depName}: Skipping closed PR check`);
      return Promise.resolve();
    }
    logger.debug(`${depName}: Checking for closed PR`);
    return github.checkForClosedPr(branchName, prTitle).then((prExisted) => {
      logger.debug(`Closed PR existed: ${prExisted}`);
      if (prExisted) {
        return Promise.reject('PR exists');
      }
      return Promise.resolve();
    });
  }

  function getBranchPr() {
    return github.getBranchPr(branchName)
    .then((branchPr) => {
      if (branchPr) {
        logger.debug(`Found open PR for ${branchName}`);
        return github.getPr(branchPr.number);
      }
      logger.debug(`Didn't find open PR for ${branchName}`);
      return null;
    });
  }

  function ensureBranch() {
    return github.branchExists(branchName)
    .then((branchExists) => {
      if (branchExists) {
        return updateExistingBranch();
      }
      return createNewBranch();
    });
  }

  function getNewPackageJson(content) {
    return packageJson.setNewValue(
      content,
      depType,
      depName,
      newVersion);
  }

  function updateExistingBranch() {
    // By default, we'll add a commit to the existing branch if necessary
    let parentBranch = branchName;
    logger.debug(`Checking if branch ${branchName} needs updating`);
    return getBranchPr()
    .then((pr) => {
      if (pr.mergeable_state === 'dirty') {
        logger.verbose(`Existing PR #${pr.number} is not mergeable`);
        if (pr.additions * pr.deletions === 1) {
          // No other changes except ours
          logger.verbose(`Rebasing ${branchName}`);
          // Setting parentBranch to undefined means that we'll use the default branch
          parentBranch = undefined;
        } else {
          logger.warning(`Cannot rebase ${branchName} as it has been modified`);
        }
      }
      return Promise.resolve();
    })
    .then(() => github.getFileContent(config.packageFile, parentBranch))
    .then((existingContent) => {
      const newContent = getNewPackageJson(existingContent);
      if (newContent === existingContent) {
        logger.debug(`Branch ${parentBranch} is already up-to-date`);
        return Promise.resolve();
      }
      logger.verbose(`Adding commit '${commitMessage}' to branch ${branchName}`);
      return github.commitFile(config.packageFile, newContent, commitMessage, parentBranch);
    })
    .then((commit) => {
      if (!commit) {
        return Promise.resolve();
      }
      return github.updateBranch(branchName, commit);
    });
  }

  function createNewBranch() {
    logger.verbose(`${depName}: creating new branch ${branchName}`);
    return github.getFileContent(config.packageFile)
    .then(getNewPackageJson)
    .then(newContent => github.commitFile(config.packageFile, newContent, commitMessage))
    .then(commit => github.createBranch(branchName, commit));
  }

  function getChangelog() {
    if (!upgrade.workingVersion || upgrade.workingVersion === upgrade.newVersion) {
      return Object.assign(upgrade, { changelog: '' });
    }
    const semverString = `>${upgrade.workingVersion} <=${upgrade.newVersion}`;
    logger.debug(`semverString: ${semverString}`);
    return changelog.generate(upgrade.depName, semverString)
      .then(changelog.markdown)
      .catch((error) => {
        logger.verbose(`getChangelog error: ${error}`);
      })
      .then((res) => {
        if (!res) {
          logger.verbose(`No changelog for ${depName}`);
          return '';
        }
        return `### Changelog\n${res}`;
      })
      .then(log => Object.assign(upgrade, { changelog: log }));
  }

  // Ensures that PR exists with matching title/body
  function ensurePr(upgradeWithChangeLog) {
    logger.debug('Ensuring PR');

    const prBody = handlebars.transform(config.prBody, upgradeWithChangeLog);

    return github.getBranchPr(branchName)
    .then(processExistingPr)
    .catch((error) => {
      logger.error(`${depName} failed to ensure PR: ${error}`);
    });

    // Create PR based on current state
    function createPr() {
      return github.createPr(branchName, prTitle, prBody).then((newPr) => {
        logger.info(`${depName}: Created PR #${newPr.number}`);
        return newPr.number;
      });
    }
    // Update PR based on current state
    function updatePr(existingPr) {
      logger.debug(`updatePr: ${existingPr.number}`);
      return github.updatePr(existingPr.number, prTitle, prBody).then(() => {
        logger.info(`${depName}: Updated PR #${existingPr.number}`);
        return Promise.resolve();
      });
    }
    // Process a returned PR
    function processExistingPr(existingPr) {
      if (!existingPr) {
        logger.debug(`Didn't find existing PR for branch ${branchName}`);
        // We need to create a new PR
        return createPr()
        .then(prNo => addLabels(prNo))
        .then(addAssignees);
      }
      // Check if existing PR needs updating
      logger.debug(`processExistingPr: ${existingPr.number}`);
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.verbose(`${depName}: PR #${existingPr.number} already up-to-date`);
        return Promise.resolve();
      }
      // PR must need updating
      return updatePr(existingPr);
    }

    // Add assignees to a PR
    function addAssignees(prNo) {
      if (config.assignees.length === 0) {
        logger.debug(`No assignees to add to ${prNo}`);
        return Promise.resolve();
      }
      return github.addAssignees(prNo, config.assignees);
    }

    // Add labels to a PR
    function addLabels(prNo) {
      if (config.labels.length === 0) {
        logger.debug(`No labels to add to ${prNo}`);
        return Promise.resolve(prNo);
      }
      return github.addLabels(prNo, config.labels)
      .then(() => prNo);
    }
  }
}
