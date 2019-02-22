const url = require('url');
const _ = require('lodash');
const addrs = require('email-addresses');

const api = require('./bb-got-wrapper');
const utils = require('./utils');
const { appSlug } = require('../../config/app-strings');
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
  logger.debug(`getRepos(${endpoint})`);
  const opts = hostRules.find({ platform }, { token, endpoint });
  // istanbul ignore next
  if (!opts.token) {
    throw new Error('No token found for getRepos');
  }
  hostRules.update({ ...opts, platform, default: true });
  try {
    const projects = await utils.accumulateValues('./rest/api/1.0/projects');
    const repos = await Promise.all(
      projects.map(({ key }) =>
        // TODO: can we filter this by permission=REPO_WRITE?
        utils.accumulateValues(`./rest/api/1.0/projects/${key}/repos`)
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
async function initRepo({
  repository,
  endpoint,
  gitAuthor,
  gitPrivateKey,
  gitFs,
  localDir,
}) {
  logger.debug(
    `initRepo("${JSON.stringify(
      { repository, endpoint, gitFs, localDir },
      null,
      2
    )}")`
  );
  const opts = hostRules.find({ platform }, { endpoint });
  // istanbul ignore if
  if (!(opts.username && opts.password)) {
    throw new Error(
      `No username/password found for Bitbucket repository ${repository}`
    );
  }
  // istanbul ignore if
  if (!opts.endpoint) {
    throw new Error(`No endpoint found for Bitbucket Server`);
  }
  hostRules.update({ ...opts, platform, default: true });
  api.reset();

  const [projectKey, repositorySlug] = repository.split('/');
  config = { projectKey, repositorySlug, gitPrivateKey };

  // Always gitFs
  const { host } = url.parse(opts.endpoint);
  const gitUrl = GitStorage.getUrl({
    gitFs: gitFs || 'https',
    auth: `${opts.username}:${opts.password}`,
    host: `${host}/scm`,
    repository,
  });

  if (gitAuthor) {
    try {
      config.gitAuthor = addrs.parseOneAddress(gitAuthor);
    } catch (err) /* istanbul ignore next */ {
      logger.error(
        { gitAuthor, err, message: err.message },
        'Invalid gitAuthor'
      );
      throw new Error('Invalid gitAuthor');
    }
  }

  config.storage = new GitStorage();
  await config.storage.initRepo({
    ...config,
    localDir,
    url: gitUrl,
  });

  const platformConfig = {};

  try {
    const info = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }`
    )).body;
    platformConfig.privateRepo = info.is_private;
    platformConfig.isFork = !!info.parent;
    platformConfig.repoFullName = info.name;
    config.owner = info.project.key;
    logger.debug(`${repository} owner = ${config.owner}`);
    config.defaultBranch = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
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

async function setBaseBranch(branchName = config.defaultBranch) {
  config.baseBranch = branchName;
  await config.storage.setBaseBranch(branchName);
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
// TODO: coverage
// istanbul ignore next
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
  // TODO: coverage
  // istanbul ignore next
  if (closePr) {
    // getBranchPr
    const pr = await getBranchPr(branchName);
    if (pr) {
      await api.post(
        `./rest/api/1.0/projects/${config.projectKey}/repos/${
          config.repositorySlug
        }/pull-requests/${pr.number}/decline?version=${pr.version + 1}`
      );
    }
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
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
async function getBranchStatus(branchName, requiredStatusChecks) {
  logger.debug(
    `getBranchStatus(${branchName}, requiredStatusChecks=${!!requiredStatusChecks})`
  );

  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    logger.debug('Status checks disabled = returning "success"');
    return 'success';
  }

  const branchCommit = await config.storage.getBranchCommit(branchName);

  try {
    const commitStatus = (await api.get(
      `./rest/build-status/1.0/commits/stats/${branchCommit}`
    )).body;

    logger.debug({ commitStatus }, 'branch status check result');

    if (commitStatus.failed > 0) return 'failed';
    if (commitStatus.inProgress > 0) return 'pending';
    return commitStatus.successful > 0 ? 'success' : 'pending';
  } catch (err) {
    logger.warn({ err }, `Failed to get branch status`);
    return 'failed';
  }
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
async function getBranchStatusCheck(branchName, context) {
  logger.debug(`getBranchStatusCheck(${branchName}, context=${context})`);

  const branchCommit = await config.storage.getBranchCommit(branchName);

  try {
    const states = await utils.accumulateValues(
      `./rest/build-status/1.0/commits/${branchCommit}`
    );

    for (const state of states) {
      if (state.key === context) {
        switch (state.state) {
          case 'SUCCESSFUL':
            return 'success';
          case 'INPROGRESS':
            return 'pending';
          case 'FAILED':
          default:
            return 'failure';
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, `Failed to check branch status`);
  }
  return null;
}

async function setBranchStatus(
  branchName,
  context,
  description,
  state,
  targetUrl
) {
  logger.debug(`setBranchStatus(${branchName})`);

  const existingStatus = await getBranchStatusCheck(branchName, context);
  if (existingStatus === state) {
    return;
  }
  logger.info({ branch: branchName, context, state }, 'Setting branch status');

  const branchCommit = await config.storage.getBranchCommit(branchName);

  try {
    const body = {
      key: context,
      description,
      url: targetUrl || 'https://renovatebot.com',
    };

    switch (state) {
      case 'success':
        body.state = 'SUCCESSFUL';
        break;
      case 'pending':
        body.state = 'INPROGRESS';
        break;
      case 'failure':
      default:
        body.state = 'FAILED';
        break;
    }

    await api.post(`./rest/build-status/1.0/commits/${branchCommit}`, { body });
  } catch (err) {
    logger.warn({ err }, `Failed to set branch status`);
  }
}

// Issue

// function getIssueList() {
//   logger.debug(`getIssueList()`);
//   // TODO: Needs implementation
//   // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
//   // BB Server doesnt have issues
//   return [];
// }

// istanbul ignore next
function findIssue(title) {
  logger.debug(`findIssue(${title})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return null;
}

// istanbul ignore next
function ensureIssue(title, body) {
  logger.debug(`ensureIssue(${title}, body={${body}})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return null;
}

// istanbul ignore next
function ensureIssueClosing(title) {
  logger.debug(`ensureIssueClosing(${title})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
}

// eslint-disable-next-line no-unused-vars
function addAssignees(iid, assignees) {
  logger.debug(`addAssignees(${iid})`);
  // TODO: Needs implementation
  // Currently Renovate does "Create PR" and then "Add assignee" as a two-step process, with this being the second step.
  // BB Server doesnt support assignees
}

async function addReviewers(iid, reviewers) {
  logger.debug(`Adding reviewers ${reviewers} to #${iid}`);
  for (const name of reviewers) {
    await api.post(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${iid}/participants`,
      { body: { user: { name }, role: 'REVIEWER' } }
    );
  }
}

// eslint-disable-next-line no-unused-vars
function deleteLabel(issueNo, label) {
  logger.debug(`deleteLabel(${issueNo})`);
  // TODO: Needs implementation
  // Only used for the "request Renovate to rebase a PR using a label" feature
}

async function getComments(prNo) {
  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities
  let comments = await utils.accumulateValues(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/activities`
  );

  if (comments && comments.length) {
    comments = comments
      .filter(a => a.action === 'COMMENTED' && a.commentAction === 'ADDED')
      .map(a => a.comment);
  }

  logger.debug(`Found ${comments.length} comments`);

  return comments;
}

async function addComment(prNo, text) {
  // POST /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments
  await api.post(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/comments`,
    {
      body: { text },
    }
  );
}

async function getCommentVersion(prNo, commentId) {
  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  const { version } = (await api.get(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/comments/${commentId}`,
    null,
    true
  )).body;

  return version;
}

async function editComment(prNo, commentId, text) {
  const version = getCommentVersion(prNo, commentId);

  // PUT /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  await api.put(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/comments/${commentId}`,
    {
      body: { text, version },
    }
  );
}

async function deleteComment(prNo, commentId) {
  const version = getCommentVersion(prNo, commentId);

  // DELETE /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  await api.delete(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/comments/${commentId}?version=${version}`
  );
}

async function ensureComment(prNo, topic, content) {
  try {
    const comments = await getComments(prNo);
    let body;
    let commentId;
    let commentNeedsUpdating;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${prNo}`);
      body = `### ${topic}\n\n${content}`;
      comments.forEach(comment => {
        if (comment.text.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.text !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${prNo}`);
      body = `${content}`;
      comments.forEach(comment => {
        if (comment.text === body) {
          commentId = comment.id;
          commentNeedsUpdating = false;
        }
      });
    }
    if (!commentId) {
      await addComment(prNo, body);
      logger.info({ repository: config.repository, prNo }, 'Comment added');
    } else if (commentNeedsUpdating) {
      await editComment(prNo, commentId, body);
      logger.info({ repository: config.repository, prNo }, 'Comment updated');
    } else {
      logger.debug('Comment is already update-to-date');
    }
    return true;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment');
    return false;
  }
}

// eslint-disable-next-line no-unused-vars
async function ensureCommentRemoval(prNo, topic) {
  try {
    logger.debug(`Ensuring comment "${topic}" in #${prNo} is removed`);
    const comments = await getComments(prNo);
    let commentId;
    comments.forEach(comment => {
      if (comment.text.startsWith(`### ${topic}\n\n`)) {
        commentId = comment.id;
      }
    });
    if (commentId) {
      await deleteComment(prNo, commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}

// TODO: coverage
// istanbul ignore next
async function getPrList() {
  logger.debug(`getPrList()`);
  if (!config.prList) {
    const values = await utils.accumulateValues(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests?state=ALL&limit=100`
    );

    config.prList = values.map(utils.prInfo);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  } else {
    logger.debug('returning cached PR list');
  }
  return config.prList;
}

// TODO: coverage
// istanbul ignore next
function matchesState(state, desiredState) {
  if (desiredState === 'all') {
    return true;
  }
  if (desiredState[0] === '!') {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

// TODO: coverage
// istanbul ignore next
const isRelevantPr = (branchName, prTitle, state) => p =>
  p.branchName === branchName &&
  (!prTitle || p.title === prTitle) &&
  matchesState(p.state, state);

// TODO: coverage
// istanbul ignore next
async function findPr(branchName, prTitle, state = 'all', refreshCache) {
  logger.debug(`findPr(${branchName}, "${prTitle}", "${state}")`);
  const prList = await getPrList({ refreshCache });
  const pr = prList.find(isRelevantPr(branchName, prTitle, state));
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
  let prInfoRes;
  try {
    prInfoRes = await api.post(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests`,
      { body }
    );
  } catch (err) /* istanbul ignore next */ {
    if (
      err.body &&
      err.body.errors &&
      err.body.errors.length &&
      err.body.errors[0].exceptionName ===
        'com.atlassian.bitbucket.pull.EmptyPullRequestException'
    ) {
      logger.info(
        'Empty pull request - deleting branch so it can be recreated next run'
      );
      await deleteBranch(branchName);
      throw new Error('repository-changed');
    }
    throw err;
  }

  const pr = {
    id: prInfoRes.body.id,
    displayNumber: `Pull Request #${prInfoRes.body.id}`,
    ...utils.prInfo(prInfoRes.body),
  };

  // istanbul ignore if
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
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`
  );

  const pr = {
    displayNumber: `Pull Request #${res.body.id}`,
    ...utils.prInfo(res.body),
  };

  if (pr.state === 'open') {
    const mergeRes = await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/merge`
    );
    pr.isConflicted = !!mergeRes.body.conflicted;
    pr.canMerge = !!mergeRes.body.canMerge;
    pr.canRebase = true;
  }

  return pr;
}

// Return a list of all modified files in a PR
function getPrFiles(mrNo) {
  logger.debug(`getPrFiles(${mrNo})`);
  // TODO: Needs implementation
  // Used only by Renovate if you want it to validate user PRs that contain modifications of the Renovate config
  return [];
}

async function updatePr(prNo, title, description) {
  logger.debug(`updatePr(${prNo}, title=${title})`);

  const { version, reviewers } = (await api.get(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`,
    null,
    true
  )).body;

  await api.put(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`,
    { body: { title, description, version, reviewers } }
  );
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp261
async function mergePr(prNo, branchName) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // Used for "automerge" feature
  try {
    const { version } = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}`,
      null,
      true
    )).body;
    await api.post(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/merge?version=${version}`
    );
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    } else if (err.statusCode === 409) {
      throw new Error('repository-changed');
    } else {
      logger.warn({ err }, `Failed to merge PR`);
      return false;
    }
  }

  logger.debug({ pr: prNo }, 'PR merged');
  // Delete branch
  await deleteBranch(branchName);
  return true;
}

function getPrBody(input) {
  logger.debug(`getPrBody(${(input || '').split('\n')[0]})`);
  // Remove any HTML we use
  return input
    .replace(/<\/?summary>/g, '**')
    .replace(/<\/?details>/g, '')
    .replace(new RegExp(`\n---\n\n.*?<!-- ${appSlug}-rebase -->.*?\n`), '')
    .substring(0, 30000);
}

function getCommitMessages() {
  logger.debug(`getCommitMessages()`);
  return config.storage.getCommitMessages();
}

function getVulnerabilityAlerts() {
  logger.debug(`getVulnerabilityAlerts()`);
  return [];
}
