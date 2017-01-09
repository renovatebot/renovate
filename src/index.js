const semver = require('semver');
const stable = require('semver-stable');

const config = require('./config');
const github = require('./helpers/github');
const npm = require('./helpers/npm');
const packageJson = require('./helpers/packageJson');

npm.init(config.verbose);

// Process arguments
const repoName = process.argv[2];
const packageFile = process.argv[3] || 'package.json';
const token = process.env.RENOVATE_TOKEN;

validateArguments();

initializeGitHub()
.then(getPackageFileContents)
.then(determineUpgrades)
.then(processUpgradesSequentially)
.catch(err => {
  console.log('renovate caught error: ' + err);
});

function validateArguments() {
  // token must be defined
  if (typeof token === 'undefined') {
    console.error('Error: Environment variable RENOVATE_TOKEN must be defined');
    process.exit(1);
  }

  // Check arguments
  if (process.argv.length < 3 || process.argv.length > 4) {
    console.error('Error: You must specify the GitHub repository and optionally path.');
    console.log('Example: node src singapore/renovate');
    console.log('Example: node src foo/bar baz/package.json');
    process.exit(1);
  }
}

function initializeGitHub() {
  if (config.verbose) {
    console.log('Initializing GitHub');
  }
  return github.init(token, repoName, config.baseBranch, config.verbose);
}

function getPackageFileContents() {
  console.log('Getting package file contents');
  return github.getFileContents(packageFile);
}

function determineUpgrades(packageFileContents) {
  console.log('Determining required upgrades');
  return npm.getAllDependencyUpgrades(packageFileContents);
}

function processUpgradesSequentially(upgrades) {
  if (config.verbose) {
    console.log('All upgrades: ' + JSON.stringify(upgrades));
  }
  // We are processing each upgrade sequentially for two major reasons:
  // 1. Reduce chances of GitHub API rate limiting
  // 2. Edge case collision of branch name, e.g. dependency also listed as dev dependency
  return upgrades.reduce((promise, upgrade) => {
    return promise.then(() => {
      return updateDependency(upgrade.depType, upgrade.depName, upgrade.currentVersion, upgrade.newVersion);
    });
  }, Promise.resolve());
}

function updateDependency(depType, depName, currentVersion, newVersion) {
  const newVersionMajor = semver.major(newVersion);
  const branchName = config.templates.branchName({depType, depName, currentVersion, newVersion, newVersionMajor});
  let prTitle = '';
  if (newVersionMajor > semver.major(currentVersion)) {
    prTitle = config.templates.prTitleMajor({ depType, depName, currentVersion, newVersion, newVersionMajor });
  } else {
    prTitle = config.templates.prTitleMinor({ depType, depName, currentVersion, newVersion, newVersionMajor });
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
    return github.getFile(packageFile, branchName).then(res => {
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
          console.log(`${depName}: Already up-to-date in branch ${branchName}`);
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
