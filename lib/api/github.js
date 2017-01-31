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
  findPr,
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
async function initRepo(repoName) {
  logger.debug(`initRepo(${repoName})`);
  config.repoName = repoName;
  try {
    const res = await ghGot(`repos/${repoName}`);
    config.owner = res.body.owner.login;
    logger.debug(`${repoName} owner = ${config.owner}`);
    config.defaultBranch = res.body.default_branch;
    logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
    config.baseCommitSHA = await getBranchCommit(config.defaultBranch);
    config.baseTreeSHA = await getCommitTree(config.baseCommitSHA);
  } catch (err) {
    logger.error(`GitHub init error: ${JSON.stringify(err)}`);
    throw err;
  }
}

// Get rate limit
async function getRateLimit() {
  return (await ghGot('rate_limit')).body;
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  const res = await ghGot(`search/code?q=repo:${config.repoName}+filename:${fileName}`);
  const exactMatches = res.body.items.filter(item => item.name === fileName);
  const filePaths = exactMatches.map(item => item.path);
  return filePaths;
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  try {
    const res = await ghGot(`repos/${config.repoName}/git/refs/heads/${branchName}`);
    if (res.statusCode === 200) {
      logger.debug('Branch exists');
      return true;
    }
    // This probably shouldn't happen
    logger.debug('Branch doesn\'t exist');
    return false;
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return false
      logger.debug('Branch doesn\'t exist');
      return false;
    }
    // Propagate if it's any other error
    throw error;
  }
}

// Creates a new branch with provided commit
// If commit not present then defaults to branch off master
async function createBranch(branchName, commit = config.baseCommitSHA) {
  await ghGot.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: commit,
    },
  });
}

async function deleteBranch(branchName) {
  await ghGot.delete(`repos/${config.repoName}/git/refs/heads/${branchName}`);
}

// Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  await ghGot.patch(`repos/${config.repoName}/git/refs/heads/${branchName}`, {
    body: {
      sha: commit,
      force: true,
    },
  });
}

// Returns the Pull Request number for a branch. Null if not exists.
async function getBranchPr(branchName) {
  const gotString = `repos/${config.repoName}/pulls?` +
    `state=open&base=${config.defaultBranch}&head=${config.owner}:${branchName}`;
  const res = await ghGot(gotString);
  if (res.body.length) {
    return res.body[0];
  }
  return null;
}

// Issue

async function addAssignees(issueNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  await ghGot.post(`repos/${config.repoName}/issues/${issueNo}/assignees`, {
    body: {
      assignees,
    },
  });
}

async function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  await ghGot.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
    body: JSON.stringify(labels),
  });
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${state})`);
  const urlString = `repos/${config.repoName}/pulls?head=${config.owner}:${branchName}&state=${state}`;
  logger.debug(`findPr urlString: ${urlString}`);
  const res = await ghGot(urlString);
  let pr = null;
  res.body.forEach((result) => {
    if (result.title === prTitle) {
      pr = result;
    }
  });
  return pr;
}

// Pull Request
async function checkForClosedPr(branchName, prTitle) {
  logger.debug(`checkForClosedPr(${branchName}, ${prTitle})`);
  const url = `repos/${config.repoName}/pulls?state=closed&head=${config.owner}:${branchName}`;
  const res = await ghGot(url);
  // Return true if any of the titles match exactly
  return res.body.some(pr => pr.title === prTitle && pr.head.label === `${config.owner}:${branchName}`);
}

async function createPr(branchName, title, body) {
  return (await ghGot.post(`repos/${config.repoName}/pulls`, {
    body: { title, head: branchName, base: config.defaultBranch, body },
  })).body;
}

async function getPr(prNo) {
  return (await ghGot(`repos/${config.repoName}/pulls/${prNo}`)).body;
}

async function updatePr(prNo, title, body) {
  await ghGot.patch(`repos/${config.repoName}/pulls/${prNo}`, {
    body: { title, body },
  });
}

// Generic File operations

async function getFile(filePath, branchName = config.defaultBranch) {
  const res = await ghGot(`repos/${config.repoName}/contents/${filePath}?ref=${branchName}`);
  return res.body.content;
}

async function getFileContent(filePath, branchName = config.baseBranch) {
  try {
    const file = await getFile(filePath, branchName);
    return new Buffer(file, 'base64').toString();
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  }
}

async function getFileJson(filePath, branchName = config.baseBranch) {
  try {
    const file = await getFile(filePath, branchName);
    return JSON.parse(new Buffer(file, 'base64').toString());
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  }
}

async function writeFile(branchName, oldFileSHA, filePath, fileContents, message) {
  await ghGot.put(`repos/${config.repoName}/contents/${filePath}`, {
    body: {
      branch: branchName,
      sha: oldFileSHA,
      message,
      content: new Buffer(fileContents).toString('base64'),
    },
  });
}

// Add a new commit, return SHA
async function commitFile(fileName, fileContents, message, parentBranch = config.defaultBranch) {
  logger.debug(`commitFile(${fileName}, fileContents, message, ${parentBranch})`);
  const parentCommit = await getBranchCommit(parentBranch);
  const parentTree = await getCommitTree(parentCommit);
  const blob = await createBlob(fileContents);
  const tree = await createTree(parentTree, fileName, blob);
  const commit = await createCommit(parentCommit, tree, message);
  return commit;
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  logger.debug('Creating blob');
  return (await ghGot.post(`repos/${config.repoName}/git/blobs`, {
    body: {
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    },
  })).body.sha;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  return (await ghGot(`repos/${config.repoName}/git/refs/heads/${branchName}`)).body.object.sha;
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  logger.debug(`getCommitTree(${commit})`);
  return (await ghGot(`repos/${config.repoName}/git/commits/${commit}`)).body.tree.sha;
}

// Create a tree and return SHA
async function createTree(baseTree, filePath, fileBlob) {
  logger.debug(`createTree(${baseTree}, ${filePath}, ${fileBlob})`);
  return (await ghGot.post(`repos/${config.repoName}/git/trees`, {
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
  })).body.sha;
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  return (await ghGot.post(`repos/${config.repoName}/git/commits`, {
    body: {
      message,
      parents: [parent],
      tree,
    },
  })).body.sha;
}
