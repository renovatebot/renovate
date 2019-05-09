const url = require('url');
const delay = require('delay');

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
  getIssueList,
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
    const repos = await utils.accumulateValues(
      `./rest/api/1.0/repos?permission=REPO_WRITE&state=AVAILABLE`
    );
    const result = repos.map(r => `${r.project.key.toLowerCase()}/${r.slug}`);
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
  gitPrivateKey,
  gitFs,
  localDir,
  bbUseDefaultReviewers,
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

  // istanbul ignore if
  if (bbUseDefaultReviewers !== false && opts.bbUseDefaultReviewers !== false) {
    config.defaultReviewers = true;
  }

  // Always gitFs
  const { host, pathname } = url.parse(opts.endpoint);
  const gitUrl = GitStorage.getUrl({
    gitFs: gitFs || 'https',
    auth: `${opts.username}:${opts.password}`,
    host: `${host}${pathname}${pathname.endsWith('/') ? '' : '/'}scm`,
    repository,
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
async function getBranchPr(branchName, refreshCache) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.number, refreshCache) : null;
}

function getAllRenovateBranches(branchPrefix) {
  logger.debug('getAllRenovateBranches');
  return config.storage.getAllRenovateBranches(branchPrefix);
}

function isBranchStale(branchName) {
  logger.debug(`isBranchStale(${branchName})`);
  return config.storage.isBranchStale(branchName);
}

async function commitFilesToBranch(
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
  await config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );

  // wait for pr change propagation
  await delay(1000);
  // refresh cache
  await getBranchPr(branchName, true);
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
        }/pull-requests/${pr.number}/decline?version=${pr.version}`
      );

      await getPr(pr.number, true);
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
function getIssueList() {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  return [];
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

  comments = comments
    .filter(a => a.action === 'COMMENTED' && a.commentAction === 'ADDED')
    .map(a => a.comment);

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
    }/pull-requests/${prNo}/comments/${commentId}`
  )).body;

  return version;
}

async function editComment(prNo, commentId, text) {
  const version = await getCommentVersion(prNo, commentId);

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
  const version = await getCommentVersion(prNo, commentId);

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
  let reviewers = [];

  // TODO: coverage
  // istanbul ignore next
  if (config.bbUseDefaultReviewers) {
    const { id } = (await api(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }`
    )).body;

    const defReviewers = (await api(
      `/rest/default-reviewers/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/reviewers?sourceRefId=refs/heads/${branchName}&targetRefId=refs/heads/${base}&sourceRepoId=${id}&targetRepoId=${id}`
    )).body;

    reviewers = defReviewers.map(u => ({ user: { name: u.name } }));
  }

  const body = {
    title,
    description,
    fromRef: {
      id: `refs/heads/${branchName}`,
    },
    toRef: {
      id: `refs/heads/${base}`,
    },
    reviewers,
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
async function getPr(prNo, refreshCache) {
  logger.debug(`getPr(${prNo})`);
  if (!prNo) {
    return null;
  }

  const res = await api.get(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}`,
    { useCache: !refreshCache }
  );

  const pr = {
    displayNumber: `Pull Request #${res.body.id}`,
    ...utils.prInfo(res.body),
    reviewers: res.body.reviewers.map(r => r.user.name),
  };

  if (pr.state === 'open') {
    const mergeRes = await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/merge`
    );
    pr.isConflicted = !!mergeRes.body.conflicted;
    pr.canMerge = !!mergeRes.body.canMerge;

    const prCommits = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/commits?withCounts=true`
    )).body;

    if (prCommits.totalCount === 1) {
      if (global.gitAuthor) {
        const commitAuthorEmail = prCommits.values[0].author.emailAddress;
        if (commitAuthorEmail === global.gitAuthor.email) {
          logger.debug(
            { prNo },
            '1 commit matches configured gitAuthor so can rebase'
          );
          pr.canRebase = true;
        } else {
          logger.debug(
            { prNo },
            '1 commit and not by configured gitAuthor so cannot rebase'
          );
          pr.canRebase = false;
        }
      } else {
        logger.debug(
          { prNo },
          '1 commit and no configured gitAuthor so can rebase'
        );
        pr.canRebase = true;
      }
    } else {
      logger.debug(
        { prNo },
        `${prCommits.totalCount} commits so cannot rebase`
      );
      pr.canRebase = false;
    }
  }

  if (await branchExists(pr.branchName)) {
    res.isStale = await isBranchStale(pr.branchName);
  }

  return pr;
}

// Return a list of all modified files in a PR
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html
async function getPrFiles(prNo) {
  logger.debug(`getPrFiles(${prNo})`);
  if (!prNo) {
    return [];
  }

  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/changes
  const values = await utils.accumulateValues(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${
      config.repositorySlug
    }/pull-requests/${prNo}/changes?withComments=false`
  );
  return values.map(f => f.path.toString);
}

async function updatePr(prNo, title, description) {
  logger.debug(`updatePr(${prNo}, title=${title})`);

  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error('not-found'), { statusCode: 404 });
    }

    await api.put(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}`,
      {
        body: {
          title,
          description,
          version: pr.version,
          reviewers: pr.reviewers.map(name => ({ user: { name } })),
        },
      }
    );
    await getPr(prNo, true);
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    } else if (err.statusCode === 409) {
      throw new Error('repository-changed');
    } else {
      logger.fatal({ err }, `Failed to update PR`);
      throw err;
    }
  }
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp261
async function mergePr(prNo, branchName) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // Used for "automerge" feature
  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error('not-found'), { statusCode: 404 });
    }
    await api.post(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/merge?version=${pr.version}`
    );
    await getPr(prNo, true);
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
    .replace(new RegExp(`\n---\n\n.*?<!-- .*?-rebase -->.*?(\n|$)`), '')
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
