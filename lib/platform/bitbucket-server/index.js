const URL = require('url');
const is = require('@sindresorhus/is');
const addrs = require('email-addresses');

const hostRules = require('../../util/host-rules');
const GitStorage = require('../git/storage');

let config = {};

module.exports = {
  getRepos,
  cleanRepo,
  initRepo,
  getRepoStatus,
  getRepoForceRebase,
  setBaseBranch,
  // Search
  getFileList,
  // Branch
  branchExists,
  getAllRenovateBranches,
  isBranchStale,
  getBranchPr,
  getBranchStatus,
  getBranchStatusCheck,
  setBranchStatus,
  deleteBranch,
  mergeBranch,
  getBranchLastCommitTime,
  // issue
  findIssue,
  ensureIssue,
  ensureIssueClosing,
  addAssignees,
  addReviewers,
  deleteLabel,
  // Comments
  ensureComment,
  ensureCommentRemoval,
  // PR
  getPrList,
  findPr,
  createPr,
  getPr,
  getPrFiles,
  updatePr,
  mergePr,
  getPrBody,
  // file
  commitFilesToBranch,
  getFile,
  // commits
  getCommitMessages,
  // vulnerability alerts
  getVulnerabilityAlerts,
};

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  throw new Error('needs implementation');
}

function cleanRepo() {}

// Initialize GitLab by getting base branch
async function initRepo({
  repository,
  token,
  endpoint,
  gitAuthor,
  gitFs,
  localDir,
}) {
  throw new Error('needs implementation');
}

function getRepoForceRebase() {
  // TODO if applicable
  return false;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    await config.storage.setBaseBranch(branchName);
  }
}

// Search

// Get full file list
function getFileList(branchName = config.baseBranch) {
  return config.storage.getFileList(branchName);
}

// Branch

// Returns true if branch exists, otherwise false
function branchExists(branchName) {
  return config.storage.branchExists(branchName);
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  throw new Error('needs implementation');
}

function getAllRenovateBranches(branchPrefix) {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

function isBranchStale(branchName) {
  return config.storage.isBranchStale(branchName);
}

async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  throw new Error('needs implementation');
}

function getFile(filePath, branchName) {
  return config.storage.getFile(filePath, branchName);
}

async function deleteBranch(branchName, closePr = false) {
  if (closePr) {
    throw new Error('needs implementation');
  }
  return config.storage.deleteBranch(branchName);
}

function mergeBranch(branchName) {
  return config.storage.mergeBranch(branchName);
}

function getBranchLastCommitTime(branchName) {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
function getRepoStatus() {
  return config.storage.getRepoStatus();
}

// Returns the combined status for a branch.
function getBranchStatus(branchName, requiredStatusChecks) {
  // TODO: Needs implementation
  return 'pending';
}

async function getBranchStatusCheck(branchName, context) {
  // TODO: Needs implementation
  return null;
}

async function setBranchStatus(
  branchName,
  context,
  description,
  state,
  targetUrl
) {
  // TODO: Needs implementation
}

// Issue

async function getIssueList() {
  // TODO: Needs implementation
  return [];
}

async function findIssue(title) {
  // TODO: Needs implementation
  return null;
}

async function ensureIssue(title, body) {
  // TODO: Needs implementation
  return null;
}

async function ensureIssueClosing(title) {
  // TODO: Needs implementation
}

async function addAssignees(iid, assignees) {
  // TODO: Needs implementation
}

function addReviewers(iid, reviewers) {
  // TODO: Needs implementation
}

async function deleteLabel(issueNo, label) {
  // TODO: Needs implementation
}

async function getComments(issueNo) {
  // TODO: Needs implementation
}

async function addComment(issueNo, body) {
  // TODO: Needs implementation
}

async function editComment(issueNo, commentId, body) {
  // TODO: Needs implementation
}

async function deleteComment(issueNo, commentId) {
  // TODO: Needs implementation
}

async function ensureComment(issueNo, topic, content) {
  // TODO: Needs implementation
}

async function ensureCommentRemoval(issueNo, topic) {
  // TODO: Needs implementation
}

async function getPrList() {
  throw new Error('needs implementation');
}

async function findPr(branchName, prTitle, state = 'all') {
  throw new Error('needs implementation');
}

// Pull Request

async function createPr(
  branchName,
  title,
  description,
  labels,
  useDefaultBranch
) {
  throw new Error('needs implementation');
}

async function getPr(iid) {
  throw new Error('needs implementation');
}

// Return a list of all modified files in a PR
async function getPrFiles(mrNo) {
  // TODO: Needs implementation
  return [];
}

async function updatePr(iid, title, description) {
  throw new Error('needs implementation');
}

async function mergePr(iid) {
  // TODO: Needs implementation
  return false;
}

function getPrBody(input) {
  throw new Error('needs implementation');
}

function getCommitMessages() {
  return config.storage.getCommitMessages();
}

function getVulnerabilityAlerts() {
  return [];
}
