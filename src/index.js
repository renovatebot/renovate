'use strict';

const Git = require('nodegit');
const got = require('got');
const semver = require('semver');
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const authorName = 'firstName lastName'; // commit credentials
const authorEmail = 'admin@example.com'; // commit credentials

const sshPublicKeyPath = `${process.env.HOME}/.ssh/id_rsa.pub`;
const sshPrivateKeyPath = `${process.env.HOME}/.ssh/id_rsa`;

if (!module.parent) {
  // https://github.com/settings/tokens/new
  const token = process.argv[2];
  const repoName = process.argv[3];
  let packageFile = process.argv[4];

  if (!token || !repoName) {
    console.error(`Usage: node index.js <token> <repo>`);
    process.exit(1);
  }
  
  if (!packageFile) {
  	packageFile = 'package.json';
  }

  updateRepo({ token, repoName, packageFile })
    .catch(err => console.log(err.stack || err));
}

function updateRepo({ token, repoName, packageFile }) {
  const repoPath = `tmp/${repoName}`;
  rimraf.sync(repoPath);
  mkdirp.sync(repoPath);

  let repo;
  let headCommit;

  return Git
    .Clone(`git@github.com:${repoName}.git`, repoPath, {
      fetchOpts: {
        callbacks: {
          credentials: getCredentials,
          certificateCheck: () => 1
        }
      }
    })
    .then(_repo => {
      repo = _repo;
      return repo.fetch('origin', {
        callbacks: {
          credentials: getCredentials
        }
      });
    })
    .then(() => {
      return repo.getHeadCommit();
    })
    .then(commit => {
      headCommit = commit;
      return readFile(headCommit, packageFile);
    })
    .then(blob => {
      const pkg = JSON.parse(blob);
      return iterateDependencies(pkg, 'dependencies')
        .then(() => iterateDependencies(pkg, 'devDependencies'));
    })
    .then(() => {
      rimraf.sync(repoPath);
    });

  function iterateDependencies(pkg, depType) {
    const deps = pkg[depType];

    return Object.keys(deps).reduce((total, depName) => {
      return total.then(() => {
        const currentVersion = deps[depName].replace(/[^\d.]/g, '');

        if (!semver.valid(currentVersion)) {
          return;
        }

        // supports scoped packages, e.g. @user/package
        return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, { json: true })
          .then(res => {
            const latestAvailable = res.body['dist-tags'].latest;

            if (semver.gt(latestAvailable, currentVersion)) {
              let majorUpgrade = false;
              if (semver.major(latestAvailable) !== semver.major(currentVersion)) {
                majorUpgrade = true;
              }
              return updateDependency(depType, depName, latestAvailable, majorUpgrade)
            }
          });
      });
    }, Promise.resolve());
  }

  function updateDependency(depType, depName, nextVersion, majorUpgrade) {
    let branchName = `upgrade/${depName}`;
    if (majorUpgrade) {
      branchName += '-major';
	}
    // try to checkout remote branche
    try {
      nativeCall(`git checkout ${branchName}`);
    } catch (e) {
      nativeCall(`git checkout -b ${branchName}`);
    }

    return updateBranch(branchName, depType, depName, nextVersion, majorUpgrade)
      .then(() => nativeCall(`git checkout master`));
  }

  function updateBranch(branchName, depType, depName, nextVersion, majorUpgrade) {
    let commit;

    return repo.getBranchCommit(branchName)
      .then(_commit => {
        commit = _commit;
        return readFile(commit, packageFile);
      })
      .then(blob => {
        const pkg = JSON.parse(String(blob));

        if (pkg[depType][depName] === nextVersion) {
          return;
        }

        pkg[depType][depName] = nextVersion;
        fs.writeFileSync(`${repoPath}/${packageFile}`, JSON.stringify(pkg, null, 2) + '\n');

        return commitAndPush(commit, depName, nextVersion, branchName, majorUpgrade);
      });
  }

  function commitAndPush(commit, depName, nextVersion, branchName, majorUpgrade) {
    let updateMessage = `Update ${depName} to version ${nextVersion}`;
    if (majorUpgrade) {
      updateMessage += ' (MAJOR)';
    }
    console.log(updateMessage);

    let index;

    return repo
      .refreshIndex()
      .then(indexResult => {
        index = indexResult;
        return index.addByPath(packageFile);
      })
      .then(() => index.write())
      .then(() => index.writeTree())
      .then(oid => {
        let author;

        if (authorName && authorEmail) {
          const date = new Date();

          author = Git.Signature.create(
            authorName,
            authorEmail,
            Math.floor(date.getTime() / 1000),
            -date.getTimezoneOffset()
          );
        } else {
          author = repo.defaultSignature();
        }

        return repo.createCommit('HEAD', author, author, updateMessage, oid, [commit]);
      })
      .then(() => Git.Remote.lookup(repo, 'origin'))
      .then(origin => {
        return origin.push(
          [`refs/heads/${branchName}:refs/heads/${branchName}`], {
            callbacks: {
              credentials: getCredentials
            }
          }
        );
      })
      .then(() => {
        let prTitle = `Update ${depName}`;
        if (majorUpgrade) {
        	prTitle += ' (MAJOR)';
        }
        return createPullRequest(branchName, prTitle);
      });
  }

  function createPullRequest(branchName, updateMessage) {
    const head = `${branchName}`;
    const options = {
      method: 'POST',
      json: true,
      headers: {
        Authorization: `token ${token}`
      },
      body: JSON.stringify({
        title: updateMessage,
        body: '',
        head,
        base: 'master'
      })
    };

    return got(`https://api.github.com/repos/${repoName}/pulls`, options)
      .then(
        null,
        err => {
          let logError = true;

          try {
            if (err.response.body.errors.find(e => e.message.indexOf('A pull request already exists') === 0)) {
              logError = false;
            }
          } catch (e) {
          }

          if (logError) {
            console.log(err);
          }
        }
      );
  }

  function readFile(commit, filename) {
    return commit
      .getEntry(packageFile)
      .then(entry => entry.getBlob())
      .then(blob => String(blob));
  }

  function getCredentials(url, userName) {
    // https://github.com/nodegit/nodegit/issues/1133#issuecomment-261779939
    return Git.Cred.sshKeyNew(
      userName,
      sshPublicKeyPath,
      sshPrivateKeyPath,
      ''
    );
  }

  function nativeCall(cmd) {
    return require('child_process').execSync(cmd, { cwd: repoPath, stdio: [null, null, null] });
  }
}
