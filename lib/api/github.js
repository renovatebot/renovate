const logger = require('winston');
const ghGot = require('gh-got');

const config = {};

module.exports = {
  initRepo,
  // Search
  findFilePaths,
  // Branch
  createBranch,
  deleteBranch,
  getBranchPr,
  // issue
  addLabels,
  // PR
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
  // file
  getFile,
  getFileJson,
  writeFile,
};

// Initialize GitHub by getting base branch and SHA
function initRepo(repoName) {
  logger.debug(`initRepo(${repoName})`);
  config.repoName = repoName;

  return getRepoMetadata().then(getRepoBaseSHA)
  .catch((err) => {
    logger.error(`GitHub init error: ${JSON.stringify(err)}`);
    throw err;
  });

  function getRepoMetadata() {
    logger.debug(`Getting metadata for ${repoName}`);
    return ghGot(`repos/${config.repoName}`)
    .then((res) => {
      config.owner = res.body.owner.login;
      config.defaultBranch = res.body.default_branch;
      return Promise.resolve();
    });
  }

  function getRepoBaseSHA() {
    logger.debug(`Getting base SHA for ${repoName}`);
    return ghGot(`repos/${config.repoName}/git/refs/head`).then((res) => {
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

// Search

// Returns an array of file paths in current repo matching the fileName
function findFilePaths(fileName) {
  return ghGot(`search/code?q=repo:${config.repoName}+filename:${fileName}`)
  .then((res) => {
    const exactMatches = res.body.items.filter(item => item.name === fileName);
    const filePaths = exactMatches.map(item => item.path);
    return filePaths;
  });
}

// Branch
function createBranch(branchName) {
  return ghGot.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: config.baseSHA,
    },
  });
}

function deleteBranch(branchName) {
  return ghGot.delete(`repos/${config.repoName}/git/refs/heads/${branchName}`);
}

function getBranchPr(branchName) {
  const gotString = `repos/${config.repoName}/pulls?` +
    `state=open&base=${config.defaultBranch}&head=${config.owner}:${branchName}`;
  return ghGot(gotString).then((res) => {
    if (res.body.length) {
      return res.body[0];
    }
    return null;
  });
}

// Issue

function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  return ghGot.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
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
    `repos/${config.repoName}/pulls?state=closed&head=${config.owner}:${branchName}`)
    .then(res =>
      res.body.some(pr => pr.title === prTitle && pr.head.label === `${config.owner}:${branchName}`))
    .catch((error) => {
      logger.error(`Error checking if PR already existed: ${error}`);
    });
}

function createPr(branchName, title, body) {
  return ghGot
    .post(`repos/${config.repoName}/pulls`, {
      body: { title, head: branchName, base: config.defaultBranch, body },
    })
    .then(res => res.body);
}

function getPr(prNo) {
  return ghGot(`repos/${config.repoName}/pulls/${prNo}`)
  .then(res => res.body);
}

function updatePr(prNo, title, body) {
  return ghGot.patch(`repos/${config.repoName}/pulls/${prNo}`, {
    body: { title, body },
  });
}

// Generic File operations
function getFile(filePath, branchName = config.defaultBranch) {
  return ghGot(`repos/${config.repoName}/contents/${filePath}?ref=${branchName}`);
}

function getFileJson(filePath, branchName = config.baseBranch) {
  return getFile(filePath, branchName)
  .then(res => JSON.parse(new Buffer(res.body.content, 'base64').toString()))
  .catch((error) => {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  });
}

function writeFile(branchName, oldFileSHA, filePath, fileContents, message) {
  return ghGot.put(`repos/${config.repoName}/contents/${filePath}`, {
    body: {
      branch: branchName,
      sha: oldFileSHA,
      message,
      content: new Buffer(fileContents).toString('base64'),
    },
  });
}
