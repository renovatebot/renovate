const ghGot = require('gh-got');

let config = {};

module.exports = {
  init,
  // Package File
  getPackageFile,
  getPackageFileContents,
  writePackageFile,
  // Branch
  createBranch,
  // PR
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
};

// Initialize GitHub by getting base branch and SHA
function init(setConfig, repoName, packageFile) {
  config = setConfig;
  config.repoName = repoName;
  config.packageFile = packageFile;

  function getRepo() {
    return ghGot(`repos/${config.repoName}`, { token: config.token })
    .then(res => res.body);
  }

  function processRepo(repo) {
    config.owner = repo.owner.login;
    config.defaultBranch = repo.default_branch;
  }

  function getRepoSHA() {
    return ghGot(`repos/${config.repoName}/git/refs/head`, {
      token: config.token,
    }).then((res) => {
      // Get the SHA for base branch
      res.body.forEach((branch) => {
        // Loop through all branches because the base branch may not be the first
        if (branch.ref === `refs/heads/${config.defaultBranch}`) {
          // This is the SHA we will create new branches from
          config.baseSHA = branch.object.sha;
        }
      });
      return Promise.resolve();
    });
  }

  return getRepo()
  .then(processRepo)
  .then(getRepoSHA)
  .catch((err) => {
    console.error(`GitHub init error: ${err}`);
    throw err;
  });
}

// Package File
function getPackageFile(branchName) {
  return getFile(config.packageFile, branchName);
}

function getPackageFileContents() {
  return getFileContents(config.packageFile);
}

function writePackageFile(branchName, oldFileSHA, fileContents, message) {
  return writeFile(
    branchName,
    oldFileSHA,
    config.packageFile,
    fileContents,
    message);
}

// Branch
function createBranch(branchName) {
  return ghGot.post(`repos/${config.repoName}/git/refs`, {
    token: config.token,
    body: {
      ref: `refs/heads/${branchName}`,
      sha: config.baseSHA,
    },
  });
}

// Pull Request
function checkForClosedPr(branchName, prTitle) {
  return ghGot(
    `repos/${config.repoName}/pulls?state=closed&head=${config.owner}:${branchName}`,
    { token: config.token })
    .then(res =>
      res.body.some(pr => pr.title === prTitle && pr.head.label === `${config.owner}:${branchName}`))
    .catch((error) => {
      console.error(`Error checking if PR already existed: ${error}`);
    });
}

function createPr(branchName, title, body) {
  return ghGot
    .post(`repos/${config.repoName}/pulls`, {
      token: config.token,
      body: { title, head: branchName, base: config.defaultBranch, body },
    })
    .then(res => res.body);
}

function getPr(branchName) {
  const gotString = `repos/${config.repoName}/pulls?` +
    `state=open&base=${config.defaultBranch}&head=${config.owner}:${branchName}`;
  return ghGot(gotString, { token: config.token }).then((res) => {
    if (res.body.length) {
      return res.body[0];
    }
    return null;
  });
}

function updatePr(prNo, title, body) {
  return ghGot.patch(`repos/${config.repoName}/pulls/${prNo}`, {
    token: config.token,
    body: { title, body },
  });
}

// Generic File operations
function getFile(filePath, branchName = config.defaultBranch) {
  return ghGot(`repos/${config.repoName}/contents/${filePath}?ref=${branchName}`,
    {
      token: config.token,
    });
}

function getFileContents(filePath, branchName) {
  return getFile(filePath, branchName)
  .then(res => JSON.parse(new Buffer(res.body.content, 'base64').toString()));
}

function writeFile(branchName, oldFileSHA, filePath, fileContents, message) {
  return ghGot.put(`repos/${config.repoName}/contents/${filePath}`, {
    token: config.token,
    body: {
      branch: branchName,
      sha: oldFileSHA,
      message,
      content: new Buffer(fileContents).toString('base64'),
    },
  });
}
