const logger = require('winston');
const ghGot = require('gh-got');

const config = {};

module.exports = {
  initRepo,
  // Branch
  createBranch,
  // issue
  addLabels,
  // PR
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
  // file
  getFile,
  getFileContents,
  writeFile,
};

// Initialize GitHub by getting base branch and SHA
function initRepo(repoName) {
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

// Branch
function createBranch(branchName) {
  return ghGot.post(`repos/${config.repoName}/git/refs`, {
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

function getPr(branchName) {
  const gotString = `repos/${config.repoName}/pulls?` +
    `state=open&base=${config.defaultBranch}&head=${config.owner}:${branchName}`;
  return ghGot(gotString).then((res) => {
    if (res.body.length) {
      return res.body[0];
    }
    return null;
  });
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

function getFileContents(filePath, branchName) {
  return getFile(filePath, branchName)
  .then(res => JSON.parse(new Buffer(res.body.content, 'base64').toString()));
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
