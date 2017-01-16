const logger = require('winston');
const changelog = require('changelog');
const github = require('./api/github');
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
  // We export the token back to ENV, on a per-repo basis
  process.env.GITHUB_TOKEN = config.token;

  logger.info(`Processing ${repoName} ${packageFile}`);

  // Start the chain
  return github.initRepo(repoName)
    .then(() => github.getFileContents(packageFile))
    .then(checkforRenovateConfig)
    .then(contents => packageJson.extractDependencies(contents, config.depTypes))
    .then(filterIgnoredDependencies)
    .then(findUpgrades)
    .then(processUpgradesSequentially)
    .then(() => { // eslint-disable-line promise/always-return
      logger.info(`${repoName} ${packageFile} done`);
    })
    .catch((error) => {
      logger.error(`renovate caught error: ${error}`);
    });
}

function checkforRenovateConfig(packageContent) {
  if (packageContent.renovate) {
    logger.debug('Found renovate configuration in package file');
    Object.assign(config, packageContent.renovate);
    logger.debug(`Updated config: ${JSON.stringify(config)}`);
  }
  return packageContent;
}

// Remove any dependencies that are on the ignore list
function filterIgnoredDependencies(dependencies) {
  return dependencies.filter(dependency => config.ignoreDeps.indexOf(dependency.depName) === -1);
}

function findUpgrades(dependencies) {
  const allDependencyUpgrades = [];
  // We create an array of promises so that they can be executed in parallel
  const allDependencyPromises = dependencies.reduce((promises, dep) => promises.concat(
    npmApi.getDependencyVersions(dep.depName)
    .then(versions => versionsHelper.determineUpgrades(dep.depName, dep.currentVersion, versions))
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
      .then(() => getChangelog(upgrade))
      .then(updateDependency), Promise.resolve());
}

function getChangelog(upgrade) {
  if (!upgrade.workingVersion || upgrade.workingVersion === upgrade.newVersion) {
    return Object.assign(upgrade, { changelog: '' });
  }
  const semverString = `>${upgrade.workingVersion} <=${upgrade.newVersion}`;
  let log = '';
  logger.debug(`semverString: ${semverString}`);
  return changelog.generate(upgrade.depName, semverString)
    .then(changelog.markdown)
    .then((res) => {
      log = res;
      return logger.silly(`${upgrade.depName} ${upgrade.newVersion} changelog: ${res}`);
    })
    .catch((error) => {
      logger.verbose(`getChangelog error: ${error}`);
    })
    .then(() => Object.assign(upgrade, { changelog: log }));
}

function updateDependency(upgrade) {
  // Expand upgrade params
  const depType = upgrade.depType;
  const depName = upgrade.depName;
  const newVersion = upgrade.newVersion;
  // Use templates to generate strings
  const branchName = config.templates.branchName(upgrade);
  let commitFunction = null;
  let prFunction = null;
  if (upgrade.upgradeType === 'pin') {
    commitFunction = config.templates.commitMessagePin;
    prFunction = config.templates.prTitlePin;
  } else if (upgrade.upgradeType === 'minor') {
    // Use same title for range or minor
    commitFunction = config.templates.commitMessage;
    prFunction = config.templates.prTitleMinor;
  } else {
    commitFunction = config.templates.commitMessage;
    prFunction = config.templates.prTitleMajor;
  }
  const commitMessage = commitFunction(upgrade);
  const prTitle = prFunction(upgrade);
  const prBody = config.templates.prBody(upgrade);

  // Check if same PR already existed and skip if so
  // This allows users to close an unwanted upgrade PR and not worry about seeing it raised again
  return github.checkForClosedPr(branchName, prTitle).then((prExisted) => {
    if (prExisted && config.recreatePrs === false) {
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
        logger.error(`Response: ${JSON.stringify(error.response.body)}`);
        throw error;
      }
      // Otherwise we swallow this error and continue
    });
  }
  function ensureCommit() {
    // Retrieve the package.json from this renovate branch
    return github.getFile(config.packageFile, branchName).then((res) => {
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
      return github.writeFile(
        branchName,
        currentSHA,
        config.packageFile,
        newPackageContents,
        commitMessage);
    })
    .catch((error) => {
      logger.error(`${depName} ensureCommit error: ${error}`);
      throw error;
    });
  }

  // Ensures that PR exists with matching title/body
  function ensurePr() {
    // Create PR based on current state
    function createPr() {
      return github.createPr(branchName, prTitle, prBody).then((newPr) => {
        logger.info(`${depName}: Created PR #${newPr.number}`);
        return newPr.number;
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
        return createPr().then(prNo => addLabels(prNo));
      }
      // Check if existing PR needs updating
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.verbose(`${depName}: PR #${existingPr.number} already up-to-date`);
        return Promise.resolve();
      }
      // PR must need updating
      return updatePr(existingPr);
    }

    // Add labels to a PR
    function addLabels(prNo) {
      if (config.labels.length === 0) {
        logger.silly(`No labels to add to ${prNo}`);
        return Promise.resolve();
      }
      return github.addLabels(prNo, config.labels);
    }

    return github.getPr(branchName)
    .then(processExistingPr)
    .catch((error) => {
      logger.error(`${depName} failed to ensure PR: ${error}`);
    });
  }
}
