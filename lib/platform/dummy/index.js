/* eslint-disable */
const files = new Map();
const prs = [];
const branches = new Map();

module.exports = {
  // Initialization
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
  // Commits
  getCommitMessages,
  // vulnerability alerts
  getVulnerabilityAlerts,

  // dummy interface
  initDummy,
  createBranch,
  createFile,
  files,
  branches,
  prs,
};

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  logger.debug(`platform.dummy.getRepos(${token}, ${endpoint}`);
}

function cleanRepo() {
  logger.debug('platform.dummy.cleanRepo');
}

// Initialize GitHub by getting base branch and SHA
async function initRepo({
  repository,
  token,
  endpoint,
  forkMode,
  forkToken,
  mirrorMode,
  gitAuthor,
  gitPrivateKey,
  gitFs,
  localDir,
}) {
  logger.debug('platform.dummy.initRepo');
}

async function getRepoForceRebase() {
  logger.debug('platform.dummy.getRepoForceRebase');
}

async function setBaseBranch(branchName) {
  logger.debug(`platform.dummy.setBaseBranch(${branchName})`);
}

// Search

// Get full file list
function getFileList(branchName = 'master') {
  logger.debug(`platform.dummy.getFileList(${branchName})`);
  return Array.from(branches.get(branchName).keys());
}

// Branch

// Returns true if branch exists, otherwise false
function branchExists(branchName) {
  logger.debug(`platform.dummy.branchExists(${branchName})`);
  return branches.has(branchName);
}

function getAllRenovateBranches(branchPrefix) {
  logger.debug(`platform.dummy.getAllRenovateBranches(${branchPrefix})`);
  return Array.from(branches.keys()).filter(branchName =>
    branchName.startsWith(branchPrefix)
  );
}

function isBranchStale(branchName = 'master') {
  logger.debug(`platform.dummy.isBranchStale(${branchName})`);
  return false;
}

function getFile(filePath, branchName = 'master') {
  logger.debug(`platform.dummy.getFile(${filePath}, ${branchName})`);
  return branches.get(branchName).get(filePath);
}

function deleteBranch(branchName = 'master') {
  logger.debug(`platform.dummy.deleteBranch(${branchName})`);
  branches.delete(branchName);
}

function getBranchLastCommitTime(branchName = 'master') {
  logger.debug(`platform.dummy.getBranchLastCommitTime(${branchName})`);
}

// istanbul ignore next
function getRepoStatus() {
  logger.debug(`platform.dummy.getRepoStatus()`);
}

function mergeBranch(branchName = 'master') {
  logger.debug(`platform.dummy.mergeBranch(${branchName})`);
}

function commitFilesToBranch(branchName, files, message, parentBranch) {
  logger.debug(
    `platform.dummy.commitFilesToBranch(${branchName}, ${files}, ${message}, ${parentBranch})`
  );
  var branchFiles = branches.get(branchName);
  if (!branchFiles) {
    branchFiles = createBranch(branchName);
  }
  files.forEach(file => {
    branchFiles.set(file.name, file.contents);
  });
}

function getCommitMessages() {
  logger.debug(`platform.dummy.getCommitMessages()`);
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`platform.dummy.getBranchPr(${branchName})`);
  return prs.find(pr => pr.branchName === branchName);
}

// Returns the combined status for a branch.
async function getBranchStatus(branchName, requiredStatusChecks) {
  logger.debug(
    `platform.dummy.getBranchStatus(${branchName}, ${requiredStatusChecks})`
  );
}

async function getBranchStatusCheck(branchName, context) {
  logger.debug(
    `platform.dummy.getBranchStatusCheck(${branchName}, ${context})`
  );
}

async function setBranchStatus(
  branchName,
  context,
  description,
  state,
  targetUrl
) {
  logger.debug(
    `platform.dummy.setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl})`
  );
}

// Issue

async function findIssue(title) {
  logger.debug(`platform.dummy.findIssue(${title})`);
}

async function ensureIssue(title, body) {
  logger.debug(`platform.dummy.ensureIssue(${title}, ${body})`);
}

async function ensureIssueClosing(title) {
  logger.debug(`platform.dummy.ensureIssueClosing(${title})`);
}

async function addAssignees(issueNo, assignees) {
  logger.debug(`platform.dummy.addAssignees(${issueNo}, ${assignees})`);
}

async function addReviewers(prNo, reviewers) {
  logger.debug(`platform.dummy.addReviewers(${prNo}, ${reviewers})`);
}

async function deleteLabel(issueNo, label) {
  logger.debug(`platform.dummy.deleteLabel(${issueNo}, ${label})`);
}

async function ensureComment(issueNo, topic, content) {
  logger.debug(
    `platform.dummy.ensureComment(${issueNo}, ${topic}, ${content})`
  );
}

async function ensureCommentRemoval(issueNo, topic) {
  logger.debug(`platform.dummy.ensureCommentRemoval(${issueNo}, ${topic})`);
}

// Pull Request

async function getPrList() {
  logger.debug(`platform.dummy.getPrList()`);
  return Promise.resolve(prs);
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`platform.dummy.findPr(${branchName}, ${prTitle}, ${state})`);
  if (state === 'all') {
    return prs.find(pr => pr.prTitle === prTitle);
  } else if (state === '!open') {
    return prs.find(pr => pr.prTitle === prTitle && pr.state !== 'open');
  }
}

// Creates PR and returns PR number
async function createPr(
  branchName,
  title,
  body,
  labels,
  useDefaultBranch,
  statusCheckVerify
) {
  logger.debug(
    `platform.dummy.createPr(${branchName}, ${title}, ${body}, ${labels}, ${useDefaultBranch}, ${statusCheckVerify})`
  );
  if (!branchExists(branchName)) {
    throw `Error creating pr ${title}: Branch does not exists: ${branchName}`;
  }
  const pr = {
    branchName: branchName,
    title: title,
    state: 'open',
    body: body,
    labels: labels,
    useDefaultBranch: useDefaultBranch,
    statusCheckVerify: statusCheckVerify,
    number: prs.length + 1,
    displayNumber: prs.length,
  };
  prs.push(pr);
  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  logger.debug(`platform.dummy.getPr(${prNo})`);
  return prs.find(pr => pr.number === prNo);
}

// Return a list of all modified files in a PR
async function getPrFiles(prNo) {
  logger.debug(`platform.dummy.getPrFiles(${prNo})`);
}

async function updatePr(prNo, title, body) {
  logger.debug(`platform.dummy.createPr(${prNo}, ${title}, ${body})`);
}

async function mergePr(prNo, branchName) {
  logger.debug(`platform.dummy.mergePr(${prNo}, ${branchName})`);
  getPr(prNo).state = 'closed';
  deleteBranch(branchName);
}

function getPrBody(input) {
  logger.debug(`platform.dummy.getPrBody(${input})`);
}

async function getVulnerabilityAlerts() {
  logger.debug(`platform.dummy.getVulnerabilityAlerts()`);
  return [];
}

function initDummy() {
  files.clear();
  prs.length = 0;
  branches.clear();
  branches.set('master', new Map());
}

function createBranch(branchName) {
  branches.set(branchName, new Map());
  return branches.get(branchName);
}

function createFile(filename, content, branchName = 'master') {
  branches.get(branchName).set(filename, content);
}
