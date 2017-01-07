const semver = require('semver');
const stable = require('semver-stable');

const config = require('./config');
const github = require('./github');
const npm = require('./npm');

const token = process.env.RENOVATE_TOKEN;
// token must be defined
if (typeof token === 'undefined') {
  console.error('Error: Environment variable RENOVATE_TOKEN must be defined');
  process.exit(1);
}

if (process.argv.length < 3 || process.argv.length > 4) {
  console.error('Error: You must specify the GitHub repository and optionally path.');
  console.log('Example: node src singapore/renovate');
  console.log('Example: node src foo/bar baz/package.json');
  process.exit(1);
}

// Process command line arguments
const repoName = process.argv[2];
const userName = repoName.split('/')[0];
const packageFile = process.argv[3] || 'package.json';

npm.init(config.verbose);

let basePackageJson;

github.init(token, repoName, config.baseBranch, config.verbose).then(() => {
  // Get the base package.json
  return github.getFileContents(packageFile);
}).then((packageContents) => {
  // Get the list of possible upgrades
  return npm.getAllDependencyUpgrades(packageContents);
}).then((upgrades) => {
  if (config.verbose) {
    console.log('All upgrades: ' + JSON.stringify(upgrades));
  }
  // We are processing each upgrade sequentially for two major reasons:
  // 1. Reduce chances of GitHub API rate limiting
  // 2. Edge case collision of branch name, e.g. dependency also listed as dev dependency
  return upgrades.reduce((promise, upgrade) => {
    return promise.then(() => {
      return updateDependency(upgrade.depType, upgrade.depName, upgrade.currentVersion, upgrade.nextVersion);
    });
  }, Promise.resolve());
}).catch(err => {
  console.log('updateDependency error: ' + err);
});

function updateDependency(depType, depName, currentVersion, nextVersion) {
  const nextVersionMajor = semver.major(nextVersion);
  const branchName = config.templates.branchName({depType, depName, currentVersion, nextVersion, nextVersionMajor});
  let prTitle = '';
  if (nextVersionMajor > semver.major(currentVersion)) {
    prTitle = config.templates.prTitleMajor({ depType, depName, currentVersion, nextVersion, nextVersionMajor });
  } else {
    prTitle = config.templates.prTitleMinor({ depType, depName, currentVersion, nextVersion, nextVersionMajor });
  }
  const prBody = config.templates.prBody({ depName, currentVersion, nextVersion });
  const commitMessage = config.templates.commitMessage({ depName, currentVersion, nextVersion });

  // Check if same PR already existed and skip if so
  return github.checkForClosedPr(branchName, prTitle).then((prExisted) => {
    if (prExisted) {
      console.log(`${depName}: Skipping due to existing PR found.`);
      return;
    }
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
    }).then(() => {
      // Retrieve the package.json from this renovate branch
      return github.getFile(packageFile, branchName).then(res => {
        const currentSHA = res.body.sha;
        let currentFileContent = JSON.parse(new Buffer(res.body.content, 'base64').toString());
        if (currentFileContent[depType][depName] !== nextVersion) {
          // Branch is new, or needs version updated
          if (config.verbose) {
            console.log(`Updating ${depName} to ${nextVersion} in branch ${branchName}`);
          }
          currentFileContent[depType][depName] = nextVersion;
          const newPackageContents = JSON.stringify(currentFileContent, null, 2) + '\n';
          return github.writeFile(branchName, currentSHA, packageFile, newPackageContents, commitMessage)
          .then(() => {
            return createOrUpdatePullRequest(branchName, prTitle, prBody);
          });
        } else {
          if (config.verbose) {
            console.log(`${depName} was already up-to-date in branch ${branchName}`);
          }
          // File was up to date. Ensure PR
          return createOrUpdatePullRequest(branchName, prTitle, prBody);
        }
      });
    })
    .catch(error => {
      console.log('Promise catch');
    });
  });
}

function createOrUpdatePullRequest(branchName, prTitle, prBody) {
  return github.getPr(branchName).then(pr => {
    if (pr) {
      if (pr.title === prTitle && pr.body === prBody) {
        if (config.verbose) {
          console.log('PR already up-to-date');
        }
      } else {
        console.log(`Updating PR #${pr.number}`);
        return github.updatePr(pr.number, prTitle, prBody);
      }
    }
  });
}
