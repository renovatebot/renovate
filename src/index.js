const semver = require('semver');

// Initialize config
const config = require('./helpers/config')();
// Expose logger
const logger = config.logger;
// Initialize helpers
const github = require('./helpers/github')(logger);
const npm = require('./helpers/npm')(logger);
const packageJson = require('./helpers/packageJson')(logger);

// Initialize our promise chain
let p = Promise.resolve();

// Queue up each repo/package combination
config.repositories.forEach((repo) => {
  repo.packageFiles.forEach((packageFile) => {
    p = p.then(() => processRepoPackageFile(repo.name, packageFile));
  });
});
p.then(() => { // eslint-disable-line promise/always-return
  logger.info('Renovate finished');
})
.catch((error) => {
  logger.error(`Unexpected error: ${error}`);
});

// This function manages the queue per-package file
function processRepoPackageFile(repoName, packageFile) {
  return initGitHubRepo(repoName)
    .then(() => { // eslint-disable-line arrow-body-style
      return packageFile;
    })
    .then(getPackageFileContents)
    .then(determineUpgrades)
    .then(processUpgradesSequentially)
    .then(() => { // eslint-disable-line promise/always-return
      logger.info(`Repo ${repoName} ${packageFile} done`);
    })
    .catch((error) => {
      logger.error(`renovate caught error: ${error}`);
    });
}

function initGitHubRepo(repoName) {
  logger.info(`Initializing GitHub repo ${repoName}`);
  return github.initRepo(config.token, repoName);
}

function getPackageFileContents(packageFile) {
  logger.info(`Getting ${packageFile} contents`);
  return github.getPackageFileContents(packageFile);
}

function determineUpgrades(packageFileContents) {
  logger.info('Determining required upgrades');
  return npm.getAllDependencyUpgrades(packageFileContents);
}

function processUpgradesSequentially(upgrades) {
  if (Object.keys(upgrades).length) {
    logger.info('Processing upgrades');
  } else {
    logger.info('No upgrades to process');
  }
  logger.verbose(`All upgrades: ${JSON.stringify(upgrades)}`);
  // We are processing each upgrade sequentially for two major reasons:
  // 1. Reduce chances of GitHub API rate limiting
  // 2. Edge case collision of branch name, e.g. dependency also listed as dev dependency
  return upgrades.reduce(
    (promise, upgrade) => promise.then(() => updateDependency(upgrade)), Promise.resolve());
}

function updateDependency({ upgradeType, depType, depName, currentVersion, newVersion }) {
  const newVersionMajor = semver.major(newVersion);
  const branchName = config.templates.branchName({
    depType,
    depName,
    currentVersion,
    newVersion,
    newVersionMajor,
  });
  let prTitle = '';
  if (upgradeType === 'pin') {
    prTitle = config.templates.prTitlePin({
      depType,
      depName,
      currentVersion,
      newVersion,
      newVersionMajor,
    });
  } else if (upgradeType === 'minor') {
    // Use same title for range or minor
    prTitle = config.templates.prTitleMinor({
      depType,
      depName,
      currentVersion,
      newVersion,
      newVersionMajor,
    });
  } else {
    prTitle = config.templates.prTitleMajor({
      depType,
      depName,
      currentVersion,
      newVersion,
      newVersionMajor,
    });
  }
  const prBody = config.templates.prBody({
    depName,
    currentVersion,
    newVersion,
  });
  const commitMessage = config.templates.commitMessage({
    depName,
    currentVersion,
    newVersion,
  });

  // Check if same PR already existed and skip if so
  // This allows users to close an unwanted upgrade PR and not worry about seeing it raised again
  return github.checkForClosedPr(branchName, prTitle).then((prExisted) => {
    if (prExisted) {
      logger.verbose(`${depName}: Skipping due to existing PR found.`);
      return Promise.resolve();
    }
    return ensureAll();
  });
  function ensureAll() {
    return ensureBranch()
    .then(ensureCommit)
    .then(ensurePr)
    .catch((error) => {
      logger.error(`Error updating dependency ${depName}:  ${error}`);
      // Don't throw here - we don't want to stop the other renovations
    });
  }
  function ensureBranch() {
    // Save an API call by attempting to create branch without checking for existence first
    return github.createBranch(branchName).catch((error) => {
      // Check in case it's because the branch already existed
      if (error.response.body.message !== 'Reference already exists') {
        // In this case it means we really do have a problem and can't continue
        logger.error(`Error creating branch: ${branchName}`);
        logger.error(`Response body: ${error.response.body}`);
        throw error;
      }
      // Otherwise we swallow this error and continue
    });
  }
  function ensureCommit() {
    // Retrieve the package.json from this renovate branch
    return github.getPackageFile(branchName).then((res) => {
      const currentSHA = res.body.sha;
      const currentFileContent = new Buffer(res.body.content, 'base64').toString();
      const currentJson = JSON.parse(currentFileContent);
      if (currentJson[depType][depName] === newVersion) {
        logger.verbose(`${depName}: branch ${branchName} is already up-to-date`);
        return Promise.resolve();
      }
      // Branch must need updating
      logger.verbose(`${depName}: Updating to ${newVersion} in branch ${branchName}`);
      const newPackageContents = packageJson.setNewValue(
        currentFileContent,
        depType,
        depName,
        newVersion);
      return github.writePackageFile(
        branchName,
        currentSHA,
        newPackageContents,
        commitMessage);
    });
  }

  // Ensures that PR exists with matching title/body
  function ensurePr() {
    // Create PR based on current state
    function createPr() {
      return github.createPr(branchName, prTitle, prBody).then((newPr) => {
        logger.info(`${depName}: Created PR #${newPr.number}`);
        return Promise.resolve();
      });
    }
    // Update PR based on current state
    function updatePr(existingPr) {
      return github.updatePr(existingPr.number, prTitle, prBody).then(() => {
        logger.info(`${depName}: Updated PR #${existingPr.number}`);
        return Promise.resolve();
      });
    }
    // Process a returned PR
    function processExistingPr(existingPr) {
      if (!existingPr) {
        // We need to create a new PR
        return createPr();
      }
      // Check if existing PR needs updating
      if (existingPr.title === prTitle || existingPr.body === prBody) {
        logger.verbose(`${depName}: PR #${existingPr.number} already up-to-date`);
        return Promise.resolve();
      }
      // PR must need updating
      return updatePr(existingPr);
    }

    return github.getPr(branchName)
    .then(processExistingPr)
    .catch((error) => {
      logger.error(`${depName} failed to ensure PR: ${error}`);
    });
  }
}
