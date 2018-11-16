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
  // This function should return true only if the user has enabled a setting on the repo that enforces PRs to be kept up to date with master
  // In such cases we rebase Renovate branches every time they fall behind
  // In GitHub this is part of "branch protection"
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
  // This is used by Renovate to determine if a branch can be automerged
  // Is also used if the user configures prCreation="not-pending"
  return 'pending';
}

async function getBranchStatusCheck(branchName, context) {
  // TODO: Needs implementation
  // This used when Renovate is adding its own status checks, such as for lock file failure or for unpublishSafe=true
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
  // This used when Renovate is adding its own status checks, such as for lock file failure or for unpublishSafe=true
}

// Issue

async function getIssueList() {
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  return [];
}

async function findIssue(title) {
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  return null;
}

async function ensureIssue(title, body) {
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  return null;
}

async function ensureIssueClosing(title) {
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
}

async function addAssignees(iid, assignees) {
  // TODO: Needs implementation
  // Currently Renovate does "Create PR" and then "Add assignee" as a two-step process, with this being the second step.
}

function addReviewers(iid, reviewers) {
  // TODO: Needs implementation
  // Only applicable if Bitbucket supports the concept of "reviewers"
}

async function deleteLabel(issueNo, label) {
  // TODO: Needs implementation
  // Only used for the "request Renovate to rebase a PR using a label" feature
}

async function ensureComment(issueNo, topic, content) {
  // TODO: Needs implementation
  // Used when Renovate needs to add comments to a PR, such as lock file errors, PR modified notifications, etc.
}

async function ensureCommentRemoval(issueNo, topic) {
  // TODO: Needs implementation
  // Used when Renovate needs to add comments to a PR, such as lock file errors, PR modified notifications, etc.
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
  // Used only by Renovate if you want it to validate user PRs that contain modifications of the Renovate config
  return [];
}

async function updatePr(iid, title, description) {
  throw new Error('needs implementation');
}

async function mergePr(iid) {
  // TODO: Needs implementation
  // Used for "automerge" feature
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
