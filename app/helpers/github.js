const ghGot = require('gh-got');

const config = {};
let logger = null;

module.exports = {
  init,
  initRepo,
  // Package File
  getPackageFile,
  getPackageFileContents,
  writePackageFile,
  // Branch
  createBranch,
  // issue
  addLabels,
  // PR
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
};

function init(token, l) {
  config.token = token;
  logger = l;
}

// Initialize GitHub by getting base branch and SHA
function initRepo(repoName) {
  config.repoName = repoName;

  return getRepo()
  .then(processRepo)
  .catch((err) => {
    logger.error(`GitHub init error: ${err}`);
    throw err;
  });

  function getRepo() {
    logger.debug(`Getting repo ${repoName}`);
    return ghGot(`repos/${config.repoName}`, { token: config.token })
    .then(res => res.body);
  }

  function processRepo(repo) {
    logger.debug(`Processing repo ${repoName}`);
    config.owner = repo.owner.login;
    config.defaultBranch = repo.default_branch;
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
}

// Package File
function getPackageFile(branchName) {
  return getFile(config.packageFile, branchName);
}

function getPackageFileContents(packageFile) {
  logger.debug(`Retrieving ${config.repoName} ${packageFile}`);
  config.packageFile = packageFile;
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

// Issue

function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  return ghGot.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
    token: config.token,
    body: JSON.stringify(labels),
  })
  .catch((error) => {
    logger.error(JSON.stringify(error));
    throw error;
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
      logger.error(`Error checking if PR already existed: ${error}`);
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
