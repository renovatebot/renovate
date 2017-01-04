const ghGot = require('gh-got');
const got = require('got');
const semver = require('semver');
const stable = require('semver-stable');

const token = process.env.RENOVATE_TOKEN;
const repoName = process.argv[2];
const userName = repoName.split('/')[0];
const packageFile = process.argv[3] || 'package.json';

let masterSHA;
let masterPackageJson;

ghGot(`repos/${repoName}/git/refs/head`, {token: token}).then(res => {
  // First, get the SHA for master branch
  res.body.forEach(function(branch) {
    // Loop through all branches because master may not be the first
    if (branch.ref === 'refs/heads/master') {
      // This is the SHA we will create new branches from
      masterSHA = branch.object.sha;
    }
  });
  // Now, retrieve the master package.json
  ghGot(`repos/${repoName}/contents/${packageFile}`, {token: token}).then(res => {
    masterPackageJson = JSON.parse(new Buffer(res.body.content, 'base64').toString());
    // Iterate through dependencies and then devDependencies
    return iterateDependencies('dependencies')
      .then(() => iterateDependencies('devDependencies'));
  }).catch(err => {
    console.log('Error reading master package.json');
  });
});

function iterateDependencies(depType) {
  const deps = masterPackageJson[depType];
  if (!deps) {
    return;
  }
  return Object.keys(deps).reduce((total, depName) => {
    return total.then(() => {
      const currentVersion = deps[depName].replace(/[^\d.]/g, '');

      if (!semver.valid(currentVersion)) {
        console.log('Invalid current version');
        return;
      }

      // supports scoped packages, e.g. @user/package
      return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, { json: true })
        .then(res => {
          let allUpgrades = {};
          Object.keys(res.body['versions']).forEach(function(version) {
            if (stable.is(currentVersion) && !stable.is(version)) {
              return;
            }
            if (semver.gt(version, currentVersion)) {
              var thisMajor = semver.major(version);
              if (!allUpgrades[thisMajor] || semver.gt(version, allUpgrades[thisMajor])) {
                allUpgrades[thisMajor] = version;
              }
            }
          });

          let upgradePromises = [];

          Object.keys(allUpgrades).forEach(function(upgrade) {
            const nextVersion = allUpgrades[upgrade];
            upgradePromises.push(updateDependency(depType, depName, currentVersion, nextVersion));
          });

          return Promise.all(upgradePromises);
        });
    });
  }, Promise.resolve());
}

function updateDependency(depType, depName, currentVersion, nextVersion) {
  const nextVersionMajor = semver.major(nextVersion);
  const branchName = `upgrade/${depName}-${nextVersionMajor}.x`;
  let prName = '';
  if (nextVersionMajor > semver.major(currentVersion)) {
    prName = `Upgrade dependency ${depName} to version ${nextVersionMajor}.x`;
    // Check if PR was already closed previously
    ghGot(`repos/${repoName}/pulls?state=closed&head=${userName}:${branchName}`, { token: token })
      .then(res => {
        if (res.body.length > 0) {
          console.log(`Dependency ${depName} upgrade to ${nextVersionMajor}.x PR already existed, so skipping`);
        } else {
          writeUpdates(depType, depName, branchName, prName, nextVersion);
        }
      });
  } else {
    prName = `Upgrade dependency ${depName} to version ${nextVersion}`;
    writeUpdates(depType, depName, branchName, prName, nextVersion);
  }
}

function writeUpdates(depType, depName, branchName, prName, nextVersion) {
  const commitMessage = `Upgrade dependency ${depName} to version ${nextVersion}`;
  // Try to create branch
  const body = {
    ref: `refs/heads/${branchName}`,
    sha: masterSHA
  };
  ghGot.post(`repos/${repoName}/git/refs`, {
    token: token,
    body: body
  }).catch(error => {
    if (error.response.body.message !== 'Reference already exists') {
      console.log('Error creating branch' + branchName);
      console.log(error.response.body);
    }
  }).then(res => {
    ghGot(`repos/${repoName}/contents/${packageFile}?ref=${branchName}`, { token: token })
    .then(res => {
      const oldFileSHA = res.body.sha;
      let branchPackageJson = JSON.parse(new Buffer(res.body.content, 'base64').toString());
      if (branchPackageJson[depType][depName] !== nextVersion) {
        // Branch is new, or needs version updated
        console.log(`Dependency ${depName} needs upgrading to ${nextVersion}`);
        branchPackageJson[depType][depName] = nextVersion;
        branchPackageString = JSON.stringify(branchPackageJson, null, 2) + '\n';

        ghGot.put(`repos/${repoName}/contents/${packageFile}`, {
          token: token,
          body: {
            branch: branchName,
            sha: oldFileSHA,
            message: commitMessage,
            content: new Buffer(branchPackageString).toString('base64')
          }
        }).then(res => {
          return createOrUpdatePullRequest(branchName, prName);
        });
      }
    });
  })
  .catch(error => {
    console.log('Promise catch');
  });
}

function createOrUpdatePullRequest(branchName, title) {
  return ghGot.post(`repos/${repoName}/pulls`, {
    token: token,
    body: {
      title: title,
      head: branchName,
      base: 'master',
      body: ''
    }
  }).then(res => {
    console.log('Created Pull Request: ' + title);
  }).catch(error => {
    if (error.response.body.errors[0].message.indexOf('A pull request already exists') === 0) {
      // Pull Request already exists
      // Now we need to find the Pull Request number
      return ghGot(`repos/${repoName}/pulls?base=master&head=${userName}:${branchName}`, {
        token: token,
      }).then(res => {
        // TODO iterate through list and confirm branch
        if (res.body.length !== 1) {
          console.error('Could not find matching PR');
          return;
        }
        const existingPrNo = res.body[0].number;
        return ghGot.patch(`repos/${repoName}/pulls/${existingPrNo}`, {
          token: token,
          body: {
            title: title
          }
        }).then(res => {
          console.log('Updated Pull Request: ' + title);
        });
      });
    } else {
      console.log('Error creating Pull Request:');
      console.log(error.response.body);
      Promise.reject();
    }
  });
}
