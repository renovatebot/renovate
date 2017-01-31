/* eslint-disable */
const logger = require('winston');
const glGot = require('gl-got');

const config = {};

module.exports = {
  initRepo,
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
  addReviewers,
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

// Initialize GitLab by getting base branch
async function initRepo(repoName) {
  logger.debug(`initRepo(${repoName})`);
  config.repoName = repoName.replace('/', '%2F');
  try {
    const res = await glGot(`projects/${config.repoName}`);
    config.defaultBranch = res.body.default_branch;
    logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
  } catch (err) {
    logger.error(`GitHub init error: ${JSON.stringify(err)}`);
    throw err;
  }
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  throw new Error('Not implemented: findFilePaths');
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  console.trace(); throw new Error(`Not implemented`);
}

// Creates a new branch with provided commit
// If commit not present then defaults to branch off master
async function createBranch(branchName, commit = config.baseCommitSHA) {
  console.trace(); throw new Error(`Not implemented`);
}

async function deleteBranch(branchName) {
  console.trace(); throw new Error(`Not implemented`);
}

// Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  console.trace(); throw new Error(`Not implemented`);
}

// Returns the Pull Request number for a branch. Null if not exists.
async function getBranchPr(branchName) {
  console.trace(); throw new Error(`Not implemented`);
}

// Issue

async function addAssignees(issueNo, assignees) {
  console.trace(); throw new Error(`Not implemented`);
}

async function addReviewers(issueNo, reviewers) {
  console.trace(); throw new Error(`Not implemented`);
}

async function addLabels(issueNo, labels) {
  console.trace(); throw new Error(`Not implemented`);
}

async function findPr(branchName, prTitle, state = 'all') {
  console.trace(); throw new Error(`Not implemented: findPr`);
}

// Pull Request
async function checkForClosedPr(branchName, prTitle) {
  console.trace(); throw new Error(`Not implemented`);
}

async function createPr(branchName, title, body) {
  console.trace(); throw new Error(`Not implemented`);
}

async function getPr(prNo) {
  console.trace(); throw new Error(`Not implemented`);
}

async function updatePr(prNo, title, body) {
  console.trace(); throw new Error(`Not implemented`);
}

// Generic File operations

async function getFile(filePath, branchName = config.defaultBranch) {
  const res = await glGot(`projects/${config.repoName}/repository/files?file_path=${filePath}&ref=${branchName}`);
  return res.body.content;
}

async function getFileContent(filePath, branchName) {
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

async function getFileJson(filePath, branchName) {
  try {
    const fileContent = await getFileContent(filePath, branchName);
    return JSON.parse(fileContent);
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
  console.trace(); throw new Error(`Not implemented`);
}

// Add a new commit, return SHA
async function commitFile(fileName, fileContents, message, parentBranch = config.defaultBranch) {
  console.trace(); throw new Error(`Not implemented`);
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  console.trace(); throw new Error(`Not implemented`);;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  console.trace(); throw new Error(`Not implemented`);
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  console.trace(); throw new Error(`Not implemented`);
}

// Create a tree and return SHA
async function createTree(baseTree, filePath, fileBlob) {
  console.trace(); throw new Error(`Not implemented`);
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  console.trace(); throw new Error(`Not implemented`);
}
