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
  return github.getFileContents(packageFile);
}).then((packageContents) => {
  basePackageJson = packageContents;
  return iterateDependencies('dependencies');
}).then(() => {
  iterateDependencies('devDependencies');
}).catch(err => {
  console.log('Error: ' + err);
});

function iterateDependencies(depType) {
  const deps = basePackageJson[depType];
  if (!deps) {
    return;
  }
  console.log(`Checking ${Object.keys(deps).length} ${depType}`);
  return Object.keys(deps).reduce((total, depName) => {
    return total.then(() => {
      if (config.verbose) {
        console.log(' * ' + depName);
      }
      const currentVersion = deps[depName].replace(/[^\d.]/g, '');
      if (!semver.valid(currentVersion)) {
        console.log(`${depName}: Invalid current version`);
        return;
      }

      return npm.getDependencyUpgrades(depName, currentVersion)
      .then(allUpgrades => {
        if (config.verbose) {
          console.log(`All upgrades for ${depName}: ${JSON.stringify(allUpgrades)}`);
        }
        return Object.keys(allUpgrades).reduce((promiseChain, upgrade) => {
          return promiseChain.then(() => {
            return updateDependency(depType, depName, currentVersion, allUpgrades[upgrade]);
          });
        }, Promise.resolve());
      });
    });
  }, Promise.resolve());
}

function updateDependency(depType, depName, currentVersion, nextVersion) {
  const nextVersionMajor = semver.major(nextVersion);
  const branchName = config.templates.branchName({depType, depName, currentVersion, nextVersion, nextVersionMajor});
  let prTitle = '';
  if (nextVersionMajor > semver.major(currentVersion)) {
    prTitle = config.templates.prTitleMajor({ depType, depName, currentVersion, nextVersion, nextVersionMajor });
  } else {
    prTitle = config.templates.prTitleMinor({ depType, depName, currentVersion, nextVersion, nextVersionMajor });
  }
  // Check if same PR already exists or existed
  return github.checkPrExists(branchName, prTitle).then((prExisted) => {
    if (!prExisted) {
      return writeUpdates(depType, depName, branchName, prTitle, currentVersion, nextVersion);
    } else {
      console.log(`${depName}: Skipping due to existing PR found.`);
    }
  });
}

function writeUpdates(depType, depName, branchName, prTitle, currentVersion, nextVersion) {
  const prBody = config.templates.prBody({ depName, currentVersion, nextVersion });
  return github.createBranch(branchName).catch(error => {
    if (error.response.body.message !== 'Reference already exists') {
      console.log('Error creating branch: ' + branchName);
      console.log(error.response.body);
    }
  }).then(res => {
    if (config.verbose) {
      console.log(`Branch exists (${branchName}), now writing file`);
    }
    return github.getFile(packageFile, branchName).then(res => {
      const oldFileSHA = res.body.sha;
      let currentFileContent = JSON.parse(new Buffer(res.body.content, 'base64').toString());
      if (currentFileContent[depType][depName] !== nextVersion) {
        // Branch is new, or needs version updated
        currentFileContent[depType][depName] = nextVersion;
        const newPackageString = JSON.stringify(currentFileContent, null, 2) + '\n';

        var commitMessage = config.templates.commitMessage({ depName, currentVersion, nextVersion });

        return github.writeFile(branchName, oldFileSHA, packageFile, newPackageString, commitMessage)
        .then(() => {
          return createOrUpdatePullRequest(branchName, prTitle, prBody);
        })
        .catch(err => {
          console.error('Error writing new package file for ' + depName);
          console.log(err);
        });
      } else {
        // File was up to date. Ensure PR
        return createOrUpdatePullRequest(branchName, prTitle, prBody);
      }
    });
  })
  .catch(error => {
    console.log('Promise catch');
  });
}

function createOrUpdatePullRequest(branchName, prTitle, prBody) {
  return github.getPrNo(branchName).then(prNo => {
    if (prNo) {
      // PR already exists - update it
      // Note: PR might be unchanged, so no log message
      return github.updatePr(prNo, prTitle, prBody)
      .catch(err => {
        console.error('Error: Failed to update Pull Request: ' + prTitle);
        console.log(err);
      });
    }
    return github.createPr(branchName, prTitle, prBody).then(res => {
      console.log('Created Pull Request: ' + prTitle);
    }).catch(err => {
      console.error('Error: Failed to create Pull Request: ' + prTitle);
      console.log(err);
    });
  });
}
