/* eslint-disable */
const logger = require('winston');
const glGot = require('gl-got');

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

// Initialize GitHub by getting base branch and SHA
async function initRepo(repoName) {
  throw new Error('Not implemented');
}

// Get rate limit
async function getRateLimit() {
  throw new Error('Not implemented');
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  throw new Error('Not implemented');
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  throw new Error('Not implemented');
}

// Creates a new branch with provided commit
// If commit not present then defaults to branch off master
async function createBranch(branchName, commit = config.baseCommitSHA) {
  throw new Error('Not implemented');
}

async function deleteBranch(branchName) {
  throw new Error('Not implemented');
}

// Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  throw new Error('Not implemented');
}

// Returns the Pull Request number for a branch. Null if not exists.
async function getBranchPr(branchName) {
  throw new Error('Not implemented');
}

// Issue

async function addAssignees(issueNo, assignees) {
  throw new Error('Not implemented');
}

async function addReviewers(issueNo, reviewers) {
  throw new Error('Not implemented');
}

async function addLabels(issueNo, labels) {
  throw new Error('Not implemented');
}

async function findPr(branchName, prTitle, state = 'all') {
  throw new Error('Not implemented');
}

// Pull Request
async function checkForClosedPr(branchName, prTitle) {
  throw new Error('Not implemented');
}

async function createPr(branchName, title, body) {
  throw new Error('Not implemented');
}

async function getPr(prNo) {
  throw new Error('Not implemented');
}

async function updatePr(prNo, title, body) {
  throw new Error('Not implemented');
}

// Generic File operations

async function getFile(filePath, branchName = config.defaultBranch) {
  throw new Error('Not implemented');
}

async function getFileContent(filePath, branchName = config.baseBranch) {
  throw new Error('Not implemented');
}

async function getFileJson(filePath, branchName = config.baseBranch) {
  throw new Error('Not implemented');
}

async function writeFile(branchName, oldFileSHA, filePath, fileContents, message) {
  throw new Error('Not implemented');
}

// Add a new commit, return SHA
async function commitFile(fileName, fileContents, message, parentBranch = config.defaultBranch) {
  throw new Error('Not implemented');
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  throw new Error('Not implemented');;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  throw new Error('Not implemented');
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  throw new Error('Not implemented');
}

// Create a tree and return SHA
async function createTree(baseTree, filePath, fileBlob) {
  throw new Error('Not implemented');
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  throw new Error('Not implemented');
}
