const semver = require('semver');
const stable = require('semver-stable');

const github = require('./helpers/github');
const npm = require('./helpers/npm');
const packageJson = require('./helpers/packageJson');

const config = initConfig();
validateArguments();
npm.init(config);

const repoName = Object.keys(config.repositories)[0];
const packageFile = config.repositories[repoName] || 'package.json';

initGitHub()
.then(getPackageFileContents)
.then(determineUpgrades)
.then(processUpgradesSequentially)
.then(() => {
  console.log('Done');
})
.catch(err => {
  console.log('renovate caught error: ' + err);
});

function initConfig() {
  const defaultConfig = require('./defaults');
  let customConfig = {};
  try {
    customConfig = require('./config');
  } catch(e) {
    // Do nothing
  }
  const cliConfig = {};
  if (process.env.RENOVATE_TOKEN) {
    cliConfig.token = process.env.RENOVATE_TOKEN;
  }
  // Check if repository name and package file are provided via CLI
  const repoName = process.argv[2];
  const packageFile = process.argv[3] || 'package.json';
  if (repoName) {
    cliConfig.repositories = {};
    cliConfig.repositories[repoName] = packageFile;
  }
  return Object.assign(defaultConfig, customConfig, cliConfig);
}

function validateArguments() {
  // token must be defined
  if (typeof config.token === 'undefined') {
    console.error('Error: A GitHub token must be configured');
    process.exit(1);
  }
  // We also need a repository
  if (typeof Object.keys(config.repositories).length === 0) {
    console.error('Error: A repository must be configured');
  }
}

function initGitHub() {
  if (config.verbose) {
    console.log('Initializing GitHub');
  }
  return github.init(config, repoName, packageFile);
}

function getPackageFileContents() {
  console.log('Getting package file contents');
  return github.getFileContents(config.packageFile);
}

function determineUpgrades(packageFileContents) {
  console.log('Determining required upgrades');
  return npm.getAllDependencyUpgrades(packageFileContents);
}

function processUpgradesSequentially(upgrades) {
  if (Object.keys(upgrades).length) {
    console.log('Processing upgrades');
  } else {
    console.log('No upgrades to process');
  }
  if (config.verbose) {
    console.log('All upgrades: ' + JSON.stringify(upgrades));
  }
  // We are processing each upgrade sequentially for two major reasons:
  // 1. Reduce chances of GitHub API rate limiting
  // 2. Edge case collision of branch name, e.g. dependency also listed as dev dependency
  return upgrades.reduce((promise, upgrade) => {
    return promise.then(() => {
      return updateDependency(upgrade);
    });
  }, Promise.resolve());
}

function updateDependency({ upgradeType, depType, depName, currentVersion, newVersion }) {
  const newVersionMajor = semver.major(newVersion);
  const branchName = config.templates.branchName({depType, depName, currentVersion, newVersion, newVersionMajor});
  let prTitle = '';
  if (upgradeType === 'pin') {
    prTitle = config.templates.prTitlePin({ depType, depName, currentVersion, newVersion, newVersionMajor });
  } else if (upgradeType === 'minor') {
    // Use same title for range or minor
    prTitle = config.templates.prTitleMinor({ depType, depName, currentVersion, newVersion, newVersionMajor });
  } else {
    prTitle = config.templates.prTitleMajor({ depType, depName, currentVersion, newVersion, newVersionMajor });
  }
  const prBody = config.templates.prBody({ depName, currentVersion, newVersion });
  const commitMessage = config.templates.commitMessage({ depName, currentVersion, newVersion });

  // Check if same PR already existed and skip if so
  // This allows users to close an unwanted upgrade PR and not worry about seeing it raised again
  return github.checkForClosedPr(branchName, prTitle).then((prExisted) => {
    if (prExisted) {
      console.log(`${depName}: Skipping due to existing PR found.`);
      return;
    }

    return ensureBranch()
    .then(ensureCommit)
    .then(ensurePr)
    .catch(error => {
      console.log('Error updating dependency depName: ' + error);
      // Don't throw here - we don't want to stop the other renovations
    });
  });
  function ensureBranch() {
    // Save an API call by attempting to create branch without checking for existence first
    return github.createBranch(branchName)
    .catch(error => {
      // Check in case it's because the branch already existed
      if (error.response.body.message !== 'Reference already exists') {
        // In this case it means we really do have a problem and can't continue
        console.log('Error creating branch: ' + branchName);
        console.log('Response body: ' + error.response.body);
        throw error;
      }
      // Otherwise we swallow this error and continue
    });
  }
  function ensureCommit() {
    // Retrieve the package.json from this renovate branch
    return github.getFile(config.packageFile, branchName).then(res => {
      const currentSHA = res.body.sha;
      const currentFileContent = new Buffer(res.body.content, 'base64').toString();
      const currentJson = JSON.parse(currentFileContent);
      if (currentJson[depType][depName] !== newVersion) {
        // Branch is new, or needs version updated
        if (config.verbose) {
          console.log(`${depName}: Updating to ${newVersion} in branch ${branchName}`);
        }
        const newPackageContents = packageJson.setNewValue(currentFileContent, depType, depName, newVersion);
        return github.writeFile(branchName, currentSHA, packageFile, newPackageContents, commitMessage);
      } else {
        if (config.verbose) {
          console.log(`${depName}: branch ${branchName} is already up-to-date`);
        }
        return;
      }
    });
  }
  function ensurePr() {
    return github.getPr(branchName).then(pr => {
      if (pr) {
        if (pr.title === prTitle && pr.body === prBody) {
          if (config.verbose) {
            console.log(`${depName}: PR #${pr.number} already up-to-date`);
          }
        } else {
          console.log(`${depName}: Updating PR #${pr.number}`);
          return github.updatePr(pr.number, prTitle, prBody);
        }
      } else {
        return github.createPr(branchName, prTitle, prBody).then((pr) => {
          console.log(`${depName}: Created PR #${pr.number}`);
        });
      }
    });
  }
}
