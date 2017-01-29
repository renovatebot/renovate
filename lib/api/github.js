const logger = require('winston');
const ghGot = require('gh-got');

const config = {};

module.exports = {
  initRepo,
  getRateLimit,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  createBranch,
  deleteBranch,
  getBranchPr,
  updateBranch,
  // issue
  addAssignees,
  addLabels,
  // PR
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
  // file
  commitFile,
  getFile,
  getFileContent,
  getFileJson,
  writeFile,
};

// Initialize GitHub by getting base branch and SHA
function initRepo(repoName) {
  logger.debug(`initRepo(${repoName})`);
  config.repoName = repoName;

  return ghGot(`repos/${repoName}`)
  .then((res) => {
    config.owner = res.body.owner.login;
    logger.debug(`${repoName} owner = ${config.owner}`);
    config.defaultBranch = res.body.default_branch;
    logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
    return config.defaultBranch;
  })
  .then(getBranchCommit)
  .then((commit) => {
    config.baseCommitSHA = commit;
    return commit;
  })
  .then(getCommitTree)
  .then((tree) => {
    config.baseTreeSHA = tree;
    return Promise.resolve();
  })
  .catch((err) => {
    logger.error(`GitHub init error: ${JSON.stringify(err)}`);
    throw err;
  });
}

// Get rate limit
function getRateLimit() {
  return ghGot('rate_limit')
  .then(res => res.body);
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

// Returns true if branch exists, otherwise false
function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  return ghGot(`repos/${config.repoName}/git/refs/heads/${branchName}`)
  .then((res) => {
    if (res.statusCode === 200) {
      logger.debug('Branch exists');
      return true;
    }
    // This probably shouldn't happen
    logger.debug('Branch doesn\'t exist');
    return false;
  })
  .catch((error) => {
    if (error.statusCode === 404) {
      // If file not found, then return false
      logger.debug('Branch doesn\'t exist');
      return false;
    }
    // Propagate if it's any other error
    throw error;
  });
}

// Creates a new branch with provided commit
// If commit not present then defaults to branch off master
function createBranch(branchName, commit = config.baseCommitSHA) {
  return ghGot.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: commit,
    },
  });
}

function deleteBranch(branchName) {
  return ghGot.delete(`repos/${config.repoName}/git/refs/heads/${branchName}`);
}

// Updates an existing branch to new commit sha
function updateBranch(branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  return ghGot.patch(`repos/${config.repoName}/git/refs/heads/${branchName}`, {
    body: {
      sha: commit,
      force: true,
    },
  });
}

// Returns the Pull Request number for a branch. Null if not exists.
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

function addAssignees(issueNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  return ghGot.post(`repos/${config.repoName}/issues/${issueNo}/assignees`, {
    body: {
      assignees,
    },
  })
  .catch((error) => {
    logger.error(JSON.stringify(error));
    throw error;
  });
}

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

function getFileContent(filePath, branchName = config.baseBranch) {
  return getFile(filePath, branchName)
  .then(res => new Buffer(res.body.content, 'base64').toString())
  .catch((error) => {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  });
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

// Add a new commit, return SHA
function commitFile(fileName, fileContents, message, parentBranch = config.defaultBranch) {
  logger.debug(`commitFile(${fileName}, fileContents, message, ${parentBranch})`);
  let parentCommit = null;
  let parentTree = null;
  return getBranchCommit(parentBranch)
  .then((commit) => {
    parentCommit = commit;
    return Promise.resolve();
  })
  .then(() => getCommitTree(parentCommit))
  .then((tree) => {
    parentTree = tree;
    return Promise.resolve();
  })
  .then(() => createBlob(fileContents))
  .then(blob => createTree(parentTree, fileName, blob))
  .then(tree => createCommit(parentCommit, tree, message));
}

// Low-level commit operations

// Create a blob with fileContents and return sha
function createBlob(fileContents) {
  logger.debug('Creating blob');
  return ghGot.post(`repos/${config.repoName}/git/blobs`, {
    body: {
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    },
  }).then(res => res.body.sha);
}

// Return the commit SHA for a branch
function getBranchCommit(branchName) {
  return ghGot(`repos/${config.repoName}/git/refs/heads/${branchName}`)
  .then((res) => {
    const commit = res.body.object.sha;
    logger.debug(`${branchName} commit = ${commit}`);
    return commit;
  });
}

// Return the tree SHA for a commit
function getCommitTree(commit) {
  logger.debug(`getCommitTree(${commit})`);
  return ghGot(`repos/${config.repoName}/git/commits/${commit}`)
  .then(res => res.body.tree.sha);
}

// Create a tree and return SHA
function createTree(baseTree, filePath, fileBlob) {
  logger.debug(`createTree(${baseTree}, ${filePath}, ${fileBlob})`);
  return ghGot.post(`repos/${config.repoName}/git/trees`, {
    body: {
      base_tree: baseTree,
      tree: [
        {
          path: filePath,
          mode: '100644',
          type: 'blob',
          sha: fileBlob,
        },
      ],
    },
  }).then(res => res.body.sha);
}

// Create a commit and return commit SHA
function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  return ghGot.post(`repos/${config.repoName}/git/commits`, {
    body: {
      message,
      parents: [parent],
      tree,
    },
  }).then(res => res.body.sha);
}
