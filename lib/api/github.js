const logger = require('winston');
const ghGot = require('gh-got');

const config = {};

module.exports = {
  initRepo,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  getBranchPr,
  // issue
  addAssignees,
  addReviewers,
  addLabels,
  // PR
  findPr,
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
  // file
  commitFileToBranch,
  getFile,
  getFileContent,
  getFileJson,
};

// Initialize GitHub by getting base branch and SHA
async function initRepo(repoName, token) {
  logger.debug(`initRepo(${repoName})`);
  if (token) {
    process.env.GITHUB_TOKEN = token;
  } else if (!process.env.GITHUB_TOKEN) {
    throw new Error(`No token found for GitHub repository ${repoName}`);
  }
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

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const gotString = `repos/${config.repoName}/pulls?` +
    `state=open&base=${config.defaultBranch}&head=${config.owner}:${branchName}`;
  const res = await ghGot(gotString);
  if (!res.body.length) {
    return null;
  }
  const prNo = res.body[0].number;
  return getPr(prNo);
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

async function addReviewers(issueNo, reviewers) {
  logger.debug(`Adding reviewers ${reviewers} to #${issueNo}`);
  await ghGot.post(`repos/${config.repoName}/pulls/${issueNo}/requested_reviewers`, {
    headers: {
      accept: 'application/vnd.github.black-cat-preview+json',
    },
    body: {
      reviewers,
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
    if (!prTitle || result.title === prTitle) {
      pr = result;
      if (pr.state === 'closed') {
        pr.isClosed = true;
      }
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

// Creates PR and returns PR number
async function createPr(branchName, title, body) {
  return (await ghGot.post(`repos/${config.repoName}/pulls`, {
    body: { title, head: branchName, base: config.defaultBranch, body },
  })).body.number;
}

// Gets details for a PR
async function getPr(prNo) {
  if (!prNo) {
    return null;
  }
  const pr = (await ghGot(`repos/${config.repoName}/pulls/${prNo}`)).body;
  if (!pr) {
    return null;
  }
  // Harmonise PR values
  if (pr.state === 'closed') {
    pr.isClosed = true;
  }
  if (pr.mergeable_state === 'dirty') {
    pr.isUnmergeable = true;
  }
  if (pr.additions * pr.deletions === 1) {
    pr.canRebase = true;
  }
  return pr;
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

// Add a new commit, create branch if not existing
async function commitFileToBranch(
  branchName,
  fileName,
  fileContents,
  message,
  parentBranch = config.defaultBranch) {
  logger.debug(`commitFileToBrach('${branchName}', '${fileName}', fileContents, message, '${parentBranch})'`);
  const parentCommit = await getBranchCommit(parentBranch);
  const parentTree = await getCommitTree(parentCommit);
  const blob = await createBlob(fileContents);
  const tree = await createTree(parentTree, fileName, blob);
  const commit = await createCommit(parentCommit, tree, message);
  const isBranchExisting = await branchExists(branchName);
  if (isBranchExisting) {
    await updateBranch(branchName, commit);
  } else {
    await createBranch(branchName, commit);
  }
}

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, commit = config.baseCommitSHA) {
  await ghGot.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: commit,
    },
  });
}

// Internal: Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  await ghGot.patch(`repos/${config.repoName}/git/refs/heads/${branchName}`, {
    body: {
      sha: commit,
      force: true,
    },
  });
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
