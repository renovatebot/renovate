const url = require('url');
// const is = require('@sindresorhus/is');
// const addrs = require('email-addresses');
const _ = require('lodash');

const api = require('./bb-got-wrapper');
const utils = require('./utils');

const hostRules = require('../../util/host-rules');
const GitStorage = require('../git/storage');

const platform = 'bitbucket-server';

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
  logger.debug(`getRepos(token, endpoint)`);
  const opts = hostRules.find({ platform }, { token, endpoint });
  // istanbul ignore next
  if (!opts.token) {
    throw new Error('No token found for getRepos');
  }
  hostRules.update({ ...opts, platform, default: true });
  try {
    const projects = await utils.accumulateValues('/rest/api/1.0/projects');
    const repos = await Promise.all(
      projects.map(({ key }) =>
        // TODO: can we filter this by permission=REPO_WRITE?
        utils.accumulateValues(`/rest/api/1.0/projects/${key}/repos`)
      )
    );
    const result = _.flatten(repos).map(
      r => `${r.project.key.toLowerCase()}/${r.name}`
    );
    logger.debug({ result }, 'result of getRepos()');
    return result;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

function cleanRepo() {
  logger.debug(`cleanRepo()`);
  if (config.storage) {
    config.storage.cleanRepo();
  }
  api.reset();
  config = {};
}

// Initialize GitLab by getting base branch
async function initRepo({ repository, endpoint, gitFs, localDir }) {
  logger.debug(
    `initRepo("${JSON.stringify(
      { repository, endpoint, gitFs, localDir },
      null,
      2
    )}")`
  );
  const opts = hostRules.find({ platform }, { endpoint });
  // istanbul ignore next
  if (!opts.token) {
    throw new Error(
      `No token found for Bitbucket Server repository ${repository}`
    );
  }
  if (!opts.endpoint) {
    throw new Error(`No endpoint found for Bitbucket Server`);
  }
  hostRules.update({ ...opts, platform, default: true });
  api.reset();

  const [projectKey, repositorySlug] = repository.split('/');
  config = { projectKey, repositorySlug };

  // Always gitFs
  const { host } = url.parse(opts.endpoint);
  const gitUrl = GitStorage.getUrl({
    gitFs: gitFs || 'https',
    auth: `${opts.username}:${opts.password}`,
    host: `${host}/scm`,
    repository: `${projectKey}/${repositorySlug}`,
  });

  config.storage = new GitStorage();
  await config.storage.initRepo({
    ...config,
    localDir,
    url: gitUrl,
  });

  const platformConfig = {};

  try {
    const info = (await api.get(
      `/rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }`
    )).body;
    platformConfig.privateRepo = info.is_private;
    platformConfig.isFork = !!info.parent;
    platformConfig.repoFullName = info.full_name;
    config.owner = info.project.key;
    logger.debug(`${repository} owner = ${config.owner}`);
    config.defaultBranch = (await api.get(
      `/rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/branches/default`
    )).body.displayId;
    config.baseBranch = config.defaultBranch;
    config.mergeMethod = 'merge';
  } catch (err) /* istanbul ignore next */ {
    logger.debug(err);
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }
  delete config.prList;
  delete config.fileList;
  await Promise.all([getPrList(), getFileList()]);
  logger.debug(
    { platformConfig },
    `platformConfig for ${config.projectKey}/${config.repositorySlug}`
  );
  return platformConfig;
}

function getRepoForceRebase() {
  logger.debug(`getRepoForceRebase()`);
  // TODO if applicable
  // This function should return true only if the user has enabled a setting on the repo that enforces PRs to be kept up to date with master
  // In such cases we rebase Renovate branches every time they fall behind
  // In GitHub this is part of "branch protection"
  return false;
}

async function setBaseBranch(branchName) {
  logger.debug(`setBaseBranch(${branchName})`);
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    await config.storage.setBaseBranch(branchName);
  }
}

// Search

// Get full file list
function getFileList(branchName = config.baseBranch) {
  logger.debug(`getFileList(${branchName})`);
  return config.storage.getFileList(branchName);
}

// Branch

// Returns true if branch exists, otherwise false
function branchExists(branchName) {
  logger.debug(`branchExists(${branchName})`);
  return config.storage.branchExists(branchName);
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.number) : null;
}

function getAllRenovateBranches(branchPrefix) {
  logger.debug('getAllRenovateBranches');
  return config.storage.getAllRenovateBranches(branchPrefix);
}

function isBranchStale(branchName) {
  logger.debug(`isBranchStale(${branchName})`);
  return config.storage.isBranchStale(branchName);
}

function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  logger.debug(
    `commitFilesToBranch(${JSON.stringify(
      { branchName, filesLength: files.length, message, parentBranch },
      null,
      2
    )})`
  );
  return config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
}

function getFile(filePath, branchName) {
  logger.debug(`getFile(${filePath}, ${branchName})`);
  return config.storage.getFile(filePath, branchName);
}

async function deleteBranch(branchName, closePr = false) {
  logger.debug(`deleteBranch(${branchName}, closePr=${closePr})`);
  if (closePr) {
    // getBranchPr
    const pr = await getBranchPr(branchName);
    await api.post(
      `/rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${pr.number}/decline?version=${pr.version + 1}`
    );
  }
  return config.storage.deleteBranch(branchName);
}

function mergeBranch(branchName) {
  logger.debug(`mergeBranch(${branchName})`);
  return config.storage.mergeBranch(branchName);
}

function getBranchLastCommitTime(branchName) {
  logger.debug(`getBranchLastCommitTime(${branchName})`);
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
function getRepoStatus() {
  return config.storage.getRepoStatus();
}

// Returns the combined status for a branch.
// umbrella for status checks
async function getBranchStatus(branchName, requiredStatusChecks) {
  logger.debug(
    `getBranchStatus(${branchName}, requiredStatusChecks=${!!requiredStatusChecks})`
  );
  const prList = await getPrList();
  const prForBranch = prList.find(x => x.branchName === branchName);

  if (!prForBranch) {
    logger.info(`There is no open PR for branch: ${branchName}`);
    // do no harm
    // TODO: is it correct way?
    return 'failed';
  }
  logger.debug({ prForBranch }, 'PRFORBRANCH');

  const res = await api.get(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prForBranch.number}/merge`
  );

  const { canMerge } = res.body;
  return canMerge ? 'success' : 'failed';
}

// lockfile
// unpublishSafe
async function getBranchStatusCheck(branchName, context) {
  logger.debug(`getBranchStatusCheck(${branchName}, context=${context})`);
  const prList = await getPrList();
  const prForBranch = prList.find(x => x.branchName === branchName);
  if (!prForBranch) {
    logger.info(`There is no open PR for branch: ${branchName}`);
    // do no harm
    // TODO is it right?
    return null;
  }
  const res = await api.get(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prForBranch.number}/merge`
  );

  const { canMerge } = res.body;
  return canMerge ? 'success' : 'failed';
}

async function setBranchStatus(
  branchName,
  context,
  description,
  state,
  targetUrl
) {
  logger.debug(`setBranchStatus(${branchName})`);
  // TODO: Needs implementation
  // This used when Renovate is adding its own status checks, such as for lock file failure or for unpublishSafe=true
  // BB Server doesnt support it AFAIK
}

// Issue

async function getIssueList() {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return [];
}

async function findIssue(title) {
  logger.debug(`findIssue(${title})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return null;
}

async function ensureIssue(title, body) {
  logger.debug(`ensureIssue(${title}, body={${body}})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return null;
}

async function ensureIssueClosing(title) {
  logger.debug(`ensureIssueClosing(${title})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
}

async function addAssignees(iid, assignees) {
  logger.debug(`addAssignees(${iid})`);
  // TODO: Needs implementation
  // Currently Renovate does "Create PR" and then "Add assignee" as a two-step process, with this being the second step.
  // BB Server doesnt support assignees
}

function addReviewers(iid, reviewers) {
  logger.debug(`addReviewers(${iid})`);
  // TODO: Needs implementation
  // Only applicable if Bitbucket supports the concept of "reviewers"
}

async function deleteLabel(issueNo, label) {
  logger.debug(`deleteLabel(${issueNo})`);
  // TODO: Needs implementation
  // Only used for the "request Renovate to rebase a PR using a label" feature
}

async function ensureComment(issueNo, topic, content) {
  logger.debug(`ensureComment(${issueNo})`);
  // TODO: Needs implementation
  // Used when Renovate needs to add comments to a PR, such as lock file errors, PR modified notifications, etc.
}

async function ensureCommentRemoval(issueNo, topic) {
  logger.debug(`ensureCommentRemoval(${issueNo})`);
  // TODO: Needs implementation
  // Used when Renovate needs to add comments to a PR, such as lock file errors, PR modified notifications, etc.
}

async function getPrList() {
  logger.debug(`getPrList()`);
  if (!config.prList) {
    const values = await utils.accumulateValues(
      `/rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests?state=OPEN`
    );

    config.prList = values.map(utils.prInfo);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  } else {
    logger.debug('returning cached PR list');
  }
  return config.prList;
}

// helper
const isRelevantPr = (branchName, prTitle, states) => p =>
  p.branchName === branchName &&
  (!prTitle || p.title === prTitle) &&
  states.includes(p.state);

async function findPr(
  branchName,
  prTitle,
  inputStates = utils.prStates.all,
  refreshCache
) {
  logger.debug(`findPr(${branchName})`);
  let states;
  // istanbul ignore if
  if (inputStates === '!open') {
    states = utils.prStates.notOpen;
  } else {
    states = inputStates;
  }
  logger.debug(`findPr(${branchName}, "${prTitle}", "${states}")`);
  const prList = await getPrList({ refreshCache });
  const pr = prList.find(isRelevantPr(branchName, prTitle, states));
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  } else {
    logger.debug(`DID NOT Found PR from branch #${branchName}`);
  }
  return pr;
}

// Pull Request

async function createPr(
  branchName,
  title,
  description,
  labels,
  useDefaultBranch
) {
  logger.debug(`createPr(${branchName}, title=${title})`);
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;

  const body = {
    title,
    description,
    fromRef: {
      id: `refs/heads/${branchName}`,
    },
    toRef: {
      id: `refs/heads/${base}`,
    },
  };

  const prInfoRes = await api.post(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests`,
    { body }
  );

  const pr = {
    id: prInfoRes.body.id,
    displayNumber: `Pull Request #${prInfoRes.body.id}`,
    ...utils.prInfo(prInfoRes.body),
  };

  if (config.prList) {
    config.prList.push(pr);
  }

  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  logger.debug(`getPr(${prNo})`);
  if (!prNo) {
    return null;
  }
  const res = await api.get(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`
  );

  const pr = {
    displayNumber: `Pull Request #${res.body.id}`,
    ...utils.prInfo(res.body),
  };

  if (utils.prStates.open.includes(pr.state)) {
    const mergeRes = await api.get(
      `/rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/merge`
    );
    pr.isConflicted = !!mergeRes.body.conflicted;
    pr.canMerge = !!mergeRes.body.canMerge;
    pr.canRebase = true; // TODO BB server assumption for now
  }

  return pr;
}

// Return a list of all modified files in a PR
async function getPrFiles(mrNo) {
  logger.debug(`getPrFiles(${mrNo})`);
  // TODO: Needs implementation
  // Used only by Renovate if you want it to validate user PRs that contain modifications of the Renovate config
  return [];
}

async function updatePr(prNo, title, description) {
  logger.debug(`updatePr(${prNo}, title=${title})`);

  const { version } = (await api.get(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`
  )).body;

  await api.put(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`,
    { body: { title, description, version } }
  );
}

async function mergePr(prNo) {
  logger.debug(`mergePr(${prNo})`);
  // TODO: Needs implementation
  // Used for "automerge" feature
  await api.post(
    `/rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/merge`
  );
}

function getPrBody(input) {
  logger.debug(`getPrBody(${(input || '').split('\n')[0]})`);
  // Remove any HTML we use
  return input
    .replace(/<\/?summary>/g, '**')
    .replace(/<\/?details>/g, '')
    .substring(0, 50000);
}

function getCommitMessages() {
  logger.debug(`getCommitMessages()`);
  return config.storage.getCommitMessages();
}

function getVulnerabilityAlerts() {
  logger.debug(`getVulnerabilityAlerts()`);
  return [];
}
