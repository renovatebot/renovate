const is = require('@sindresorhus/is');
const addrs = require('email-addresses');
const delay = require('delay');
const URL = require('url');

const get = require('./gh-got-wrapper');
const hostRules = require('../../util/host-rules');
const Storage = require('./storage');
const GitStorage = require('../git/storage');

const {
  appName,
  appSlug,
  configFileNames,
  urls,
} = require('../../config/app-strings');

const defaultConfigFile = configFileNames[0];

let config = {};

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
};

// istanbul ignore next
async function getRenovateUsername() {
  if (!global.renovateUsername) {
    try {
      global.renovateUsername = (await get('user')).body.login;
    } catch (err) {
      if (err.message === 'integration-unauthorized') {
        global.renovateUsername = 'renovate[bot]';
      } else {
        throw err;
      }
    }
  }
  return global.renovateUsername;
}

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  logger.info('Autodiscovering GitHub repositories');
  const opts = hostRules.find({ platform: 'github' }, { token, endpoint });
  if (!opts.token) {
    throw new Error('No token found for getRepos');
  }
  hostRules.update({ ...opts, platform: 'github', default: true });
  try {
    const res = await get('user/repos', { paginate: true });
    return res.body.map(repo => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `GitHub getRepos error`);
    throw err;
  }
}

function cleanRepo() {
  // istanbul ignore if
  if (config.storage) {
    config.storage.cleanRepo();
  }
  // In theory most of this isn't necessary. In practice..
  get.reset();
  config = {};
}

// Initialize GitHub by getting base branch and SHA
async function initRepo({
  repository,
  token,
  endpoint,
  forkMode,
  forkToken,
  gitAuthor,
  gitPrivateKey,
  gitFs,
  localDir,
  includeForks,
}) {
  logger.debug(`initRepo("${repository}")`);
  const opts = hostRules.find({ platform: 'github' }, { token, endpoint });
  if (!opts.token) {
    throw new Error(`No token found for GitHub repository ${repository}`);
  }
  hostRules.update({ ...opts, platform: 'github', default: true });
  logger.info('Authenticated as user: ' + (await getRenovateUsername()));
  logger.info('Using renovate version: ' + global.renovateVersion);
  // config is used by the platform api itself, not necessary for the app layer to know
  cleanRepo();
  config.isGhe = endpoint && !endpoint.startsWith('https://api.github.com');
  config.localDir = localDir;
  config.platform = 'github';
  config.repository = repository;
  [config.repositoryOwner, config.repositoryName] = repository.split('/');
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
  config.gitPrivateKey = gitPrivateKey;
  // platformConfig is passed back to the app layer and contains info about the platform they require
  const platformConfig = {};
  let res;
  try {
    res = await get(`repos/${repository}`);
    logger.trace({ repositoryDetails: res.body }, 'Repository details');
    // istanbul ignore if
    if (res.body.fork && gitFs && !includeForks) {
      try {
        const renovateConfig = JSON.parse(
          Buffer.from(
            (await get(
              `repos/${config.repository}/contents/${defaultConfigFile}`
            )).body.content,
            'base64'
          ).toString()
        );
        if (!renovateConfig.includeForks) {
          throw new Error();
        }
      } catch (err) {
        throw new Error('fork');
      }
    }
    // istanbul ignore if
    if (res.body.full_name && res.body.full_name !== repository) {
      logger.info(
        { repository, this_repository: res.body.full_name },
        'Repository has been renamed'
      );
      throw new Error('renamed');
    }
    if (res.body.archived) {
      logger.info(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error('archived');
    }
    platformConfig.privateRepo = res.body.private === true;
    platformConfig.isFork = res.body.fork === true;
    const owner = res.body.owner.login;
    logger.debug(`${repository} owner = ${owner}`);
    // Use default branch as PR target unless later overridden.
    config.defaultBranch = res.body.default_branch;
    // Base branch may be configured but defaultBranch is always fixed
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    // GitHub allows administrators to block certain types of merge, so we need to check it
    if (res.body.allow_rebase_merge) {
      config.mergeMethod = 'rebase';
    } else if (res.body.allow_squash_merge) {
      config.mergeMethod = 'squash';
    } else if (res.body.allow_merge_commit) {
      config.mergeMethod = 'merge';
    } else {
      // This happens if we don't have Administrator read access, it is not a critical error
      logger.info('Could not find allowed merge methods for repo');
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug('Caught initRepo error');
    if (err.message === 'archived' || err.message === 'renamed') {
      throw err;
    }
    if (err.statusCode === 403) {
      throw new Error('forbidden');
    }
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    if (err.message.startsWith('Repository access blocked')) {
      throw new Error('blocked');
    }
    if (err.message === 'fork') {
      throw err;
    }
    logger.info({ err }, 'Unknown GitHub initRepo error');
    throw err;
  }
  // This shouldn't be necessary, but occasional strange errors happened until it was added
  config.issueList = null;
  config.prList = null;
  config.openPrList = null;
  config.closedPrList = null;
  config.storage = new Storage();
  await config.storage.initRepo(config);
  if (forkMode) {
    logger.info('Bot is in forkMode');
    config.forkToken = forkToken;
    // Save parent SHA then delete
    const parentSha = await getBaseCommitSHA();
    config.baseCommitSHA = null;
    // save parent name then delete
    config.parentRepo = config.repository;
    config.repository = null;
    // Get list of existing repos
    const existingRepos = (await get('user/repos?per_page=100', {
      token: forkToken || opts.token,
      paginate: true,
    })).body.map(r => r.full_name);
    try {
      config.repository = (await get.post(`repos/${repository}/forks`, {
        token: forkToken || opts.token,
      })).body.full_name;
    } catch (err) /* istanbul ignore next */ {
      logger.info({ err }, 'Error forking repository');
      throw new Error('cannot-fork');
    }
    if (existingRepos.includes(config.repository)) {
      logger.info(
        { repository_fork: config.repository },
        'Found existing fork'
      );
      // Need to update base branch
      logger.debug(
        { baseBranch: config.baseBranch, parentSha },
        'Setting baseBranch ref in fork'
      );
      // This is a lovely "hack" by GitHub that lets us force update our fork's master
      // with the base commit from the parent repository
      try {
        await get.patch(
          `repos/${config.repository}/git/refs/heads/${config.baseBranch}`,
          {
            body: {
              sha: parentSha,
              force: true,
            },
            token: forkToken || opts.token,
          }
        );
      } catch (err) /* istanbul ignore next */ {
        if (
          err.statusCode === 422 &&
          err.message.startsWith('Object does not exist')
        ) {
          throw new Error('repository-changed');
        }
      }
    } else {
      logger.info({ repository_fork: config.repository }, 'Created fork');
      // Wait an arbitrary 30s to hopefully give GitHub enough time for forking to complete
      await delay(30000);
    }
    await config.storage.initRepo(config);
  }

  // istanbul ignore if
  if (gitFs) {
    logger.debug('Enabling Git FS');
    let { host } = URL.parse(opts.endpoint);
    if (host === 'api.github.com') {
      host = null;
    }
    host = host || 'github.com';
    const url = GitStorage.getUrl({
      gitFs,
      auth:
        config.forkToken ||
        (global.appMode ? `x-access-token:${opts.token}` : opts.token),
      hostname: host,
      repository,
    });
    config.storage = new GitStorage();
    await config.storage.initRepo({
      ...config,
      url,
    });
  }

  return platformConfig;
}

async function getRepoForceRebase() {
  if (config.repoForceRebase === undefined) {
    try {
      config.repoForceRebase = false;
      const branchProtection = await getBranchProtection(config.baseBranch);
      logger.debug('Found branch protection');
      if (branchProtection.required_pull_request_reviews) {
        logger.debug(
          'Branch protection: PR Reviews are required before merging'
        );
        config.prReviewsRequired = true;
      }
      if (branchProtection.required_status_checks) {
        if (branchProtection.required_status_checks.strict) {
          logger.debug(
            'Branch protection: PRs must be up-to-date before merging'
          );
          config.repoForceRebase = true;
        }
      }
      if (branchProtection.restrictions) {
        logger.debug(
          {
            users: branchProtection.restrictions.users,
            teams: branchProtection.restrictions.teams,
          },
          'Branch protection: Pushing to branch is restricted'
        );
        config.pushProtection = true;
      }
    } catch (err) {
      if (err.statusCode === 404) {
        logger.debug(`No branch protection found`);
      } else if (err.statusCode === 403) {
        logger.debug(
          'Branch protection: Do not have permissions to detect branch protection'
        );
      } else {
        throw err;
      }
    }
  }
  return config.repoForceRebase;
}

async function getBaseCommitSHA() {
  if (!config.baseCommitSHA) {
    config.baseCommitSHA = await config.storage.getBranchCommit(
      config.baseBranch
    );
  }
  return config.baseCommitSHA;
}

async function getBranchProtection(branchName) {
  // istanbul ignore if
  if (config.parentRepo) {
    return {};
  }
  const res = await get(
    `repos/${config.repository}/branches/${branchName}/protection`
  );
  return res.body;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    config.baseCommitSHA = null;
    config.storage.setBaseBranch(branchName);
    await getFileList(branchName);
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

function getAllRenovateBranches(branchPrefix) {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

function isBranchStale(branchName) {
  return config.storage.isBranchStale(branchName);
}

function getFile(filePath, branchName) {
  return config.storage.getFile(filePath, branchName);
}

function deleteBranch(branchName) {
  return config.storage.deleteBranch(branchName);
}

function getBranchLastCommitTime(branchName) {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
function getRepoStatus() {
  return config.storage.getRepoStatus();
}

function mergeBranch(branchName) {
  // istanbul ignore if
  if (config.pushProtection) {
    logger.info(
      { branch: branchName },
      'Branch protection: Attempting to merge branch when push protection is enabled'
    );
  }
  return config.storage.mergeBranch(branchName);
}

function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  return config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
}

function getCommitMessages() {
  return config.storage.getCommitMessages();
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.number) : null;
}

// Returns the combined status for a branch.
async function getBranchStatus(branchName, requiredStatusChecks) {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    logger.debug('Status checks disabled = returning "success"');
    return 'success';
  }
  if (requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return 'failed';
  }
  const commitStatusUrl = `repos/${
    config.repository
  }/commits/${branchName}/status`;
  const commitStatus = (await get(commitStatusUrl)).body;
  logger.debug(
    { state: commitStatus.state, statuses: commitStatus.statuses },
    'branch status check result'
  );
  let checkRuns = [];
  if (!config.isGhe) {
    try {
      const checkRunsUrl = `repos/${
        config.repository
      }/commits/${branchName}/check-runs`;
      const opts = {
        headers: {
          Accept: 'application/vnd.github.antiope-preview+json',
        },
      };
      const checkRunsRaw = (await get(checkRunsUrl, opts)).body;
      if (checkRunsRaw.check_runs && checkRunsRaw.check_runs.length) {
        checkRuns = checkRunsRaw.check_runs.map(run => ({
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
        }));
        logger.debug({ checkRuns }, 'check runs result');
      } else {
        // istanbul ignore next
        logger.debug({ result: checkRunsRaw }, 'No check runs found');
      }
    } catch (err) /* istanbul ignore next */ {
      if (
        err.statusCode === 403 ||
        err.message === 'integration-unauthorized'
      ) {
        logger.info('No permission to view check runs');
      } else {
        logger.warn({ err }, 'Error retrieving check runs');
      }
    }
  }
  if (checkRuns.length === 0) {
    return commitStatus.state;
  }
  if (
    commitStatus.state === 'failed' ||
    checkRuns.some(run => run.conclusion === 'failed')
  ) {
    return 'failed';
  }
  if (
    (commitStatus.state === 'success' || commitStatus.statuses.length === 0) &&
    checkRuns.every(run => ['neutral', 'success'].includes(run.conclusion))
  ) {
    return 'success';
  }
  return 'pending';
}

async function getBranchStatusCheck(branchName, context) {
  const branchCommit = await config.storage.getBranchCommit(branchName);
  const url = `repos/${config.repository}/commits/${branchCommit}/statuses`;
  const res = await get(url);
  for (const check of res.body) {
    if (check.context === context) {
      return check.state;
    }
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
  // istanbul ignore if
  if (config.parentRepo) {
    logger.info('Cannot set branch status when in forking mode');
    return;
  }
  const existingStatus = await getBranchStatusCheck(branchName, context);
  if (existingStatus === state) {
    return;
  }
  logger.info({ branch: branchName, context, state }, 'Setting branch status');
  const branchCommit = await config.storage.getBranchCommit(branchName);
  const url = `repos/${config.repository}/statuses/${branchCommit}`;
  const options = {
    state,
    description,
    context,
  };
  if (targetUrl) {
    options.target_url = targetUrl;
  }
  await get.post(url, { body: options });
}

// Issue

async function getIssueList() {
  if (!config.issueList) {
    logger.debug('Retrieving issueList');
    const renovateUsername = await getRenovateUsername();
    const res = await get(
      `repos/${config.parentRepo ||
        config.repository}/issues?creator=${renovateUsername}&state=all&per_page=100&sort=created&direction=asc`,
      { paginate: 'all', useCache: false }
    );
    // istanbul ignore if
    if (!is.array(res.body)) {
      logger.warn({ responseBody: res.body }, 'Could not retrieve issue list');
      return [];
    }
    config.issueList = res.body
      .filter(issue => !issue.pull_request)
      .map(i => ({
        number: i.number,
        state: i.state,
        title: i.title,
      }));
    logger.debug('Retrieved ' + config.issueList.length + ' issues');
  }
  return config.issueList;
}

async function findIssue(title) {
  logger.debug(`findIssue(${title})`);
  try {
    const [issue] = (await getIssueList()).filter(
      i => i.state === 'open' && i.title === title
    );
    if (!issue) {
      return null;
    }
    logger.debug('Found issue ' + issue.number);
    const issueBody = (await get(
      `repos/${config.parentRepo || config.repository}/issues/${issue.number}`
    )).body.body;
    return {
      number: issue.number,
      body: issueBody,
    };
  } catch (err) /* istanbul ignore next */ {
    logger.warn('Error finding issue');
    return null;
  }
}

async function ensureIssue(title, body, once = false) {
  logger.debug(`ensureIssue()`);
  try {
    const issueList = await getIssueList();
    const issues = issueList.filter(i => i.title === title);
    if (issues.length) {
      let issue = issues.find(i => i.state === 'open');
      if (!issue) {
        if (once) {
          logger.debug('Issue already closed - skipping recreation');
          return null;
        }
        logger.info('Reopening previously closed issue');
        issue = issues[issues.length - 1];
      }
      for (const i of issues) {
        if (i.state === 'open' && i.number !== issue.number) {
          logger.warn('Closing duplicate issue ' + i.number);
          await closeIssue(i.number);
        }
      }
      const issueBody = (await get(
        `repos/${config.parentRepo || config.repository}/issues/${issue.number}`
      )).body.body;
      if (issueBody === body && issue.state === 'open') {
        logger.info('Issue is open and up to date - nothing to do');
        return null;
      }
      logger.info('Patching issue');
      await get.patch(
        `repos/${config.parentRepo || config.repository}/issues/${
          issue.number
        }`,
        {
          body: { body, state: 'open' },
        }
      );
      logger.info('Issue updated');
      return 'updated';
    }
    await get.post(`repos/${config.parentRepo || config.repository}/issues`, {
      body: {
        title,
        body,
      },
    });
    logger.info('Issue created');
    // reset issueList so that it will be fetched again as-needed
    delete config.issueList;
    return 'created';
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Issues are disabled for this repo')) {
      logger.info(
        `Issues are disabled, so could not create issue: ${err.message}`
      );
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

async function closeIssue(issueNumber) {
  logger.debug(`closeIssue(${issueNumber})`);
  await get.patch(
    `repos/${config.parentRepo || config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

async function ensureIssueClosing(title) {
  logger.debug(`ensureIssueClosing()`);
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.state === 'open' && issue.title === title) {
      await closeIssue(issue.number);
      logger.info({ number: issue.number }, 'Issue closed');
    }
  }
}

async function addAssignees(issueNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  const repository = config.parentRepo || config.repository;
  await get.post(`repos/${repository}/issues/${issueNo}/assignees`, {
    body: {
      assignees,
    },
  });
}

async function addReviewers(prNo, reviewers) {
  logger.debug(`Adding reviewers ${reviewers} to #${prNo}`);
  await get.post(
    `repos/${config.parentRepo ||
      config.repository}/pulls/${prNo}/requested_reviewers`,
    {
      body: {
        reviewers,
      },
    }
  );
}

async function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  const repository = config.parentRepo || config.repository;
  if (is.array(labels) && labels.length) {
    await get.post(`repos/${repository}/issues/${issueNo}/labels`, {
      body: labels,
    });
  }
}

async function deleteLabel(issueNo, label) {
  logger.debug(`Deleting label ${label} from #${issueNo}`);
  const repository = config.parentRepo || config.repository;
  try {
    await get.delete(`repos/${repository}/issues/${issueNo}/labels/${label}`);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, issueNo, label }, 'Failed to delete label');
  }
}

async function getComments(issueNo) {
  const pr = (await getClosedPrs())[issueNo];
  if (pr) {
    logger.debug('Returning closed PR list comments');
    return pr.comments;
  }
  // GET /repos/:owner/:repo/issues/:number/comments
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `repos/${config.parentRepo ||
    config.repository}/issues/${issueNo}/comments?per_page=100`;
  const comments = (await get(url, { paginate: true })).body;
  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(issueNo, body) {
  // POST /repos/:owner/:repo/issues/:number/comments
  await get.post(
    `repos/${config.parentRepo ||
      config.repository}/issues/${issueNo}/comments`,
    {
      body: { body },
    }
  );
}

async function editComment(commentId, body) {
  // PATCH /repos/:owner/:repo/issues/comments/:id
  await get.patch(
    `repos/${config.parentRepo ||
      config.repository}/issues/comments/${commentId}`,
    {
      body: { body },
    }
  );
}

async function deleteComment(commentId) {
  // DELETE /repos/:owner/:repo/issues/comments/:id
  await get.delete(
    `repos/${config.parentRepo ||
      config.repository}/issues/comments/${commentId}`
  );
}

async function ensureComment(issueNo, topic, content) {
  try {
    const comments = await getComments(issueNo);
    let body;
    let commentId;
    let commentNeedsUpdating;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${issueNo}`);
      body = `### ${topic}\n\n${content}`;
      comments.forEach(comment => {
        if (comment.body.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.body !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${issueNo}`);
      body = `${content}`;
      comments.forEach(comment => {
        if (comment.body === body) {
          commentId = comment.id;
          commentNeedsUpdating = false;
        }
      });
    }
    if (!commentId) {
      await addComment(issueNo, body);
      logger.info({ repository: config.repository, issueNo }, 'Comment added');
    } else if (commentNeedsUpdating) {
      await editComment(commentId, body);
      logger.info(
        { repository: config.repository, issueNo },
        'Comment updated'
      );
    } else {
      logger.debug('Comment is already update-to-date');
    }
    return true;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment');
    return false;
  }
}

async function ensureCommentRemoval(issueNo, topic) {
  try {
    logger.debug(`Ensuring comment "${topic}" in #${issueNo} is removed`);
    const comments = await getComments(issueNo);
    let commentId;
    comments.forEach(comment => {
      if (comment.body.startsWith(`### ${topic}\n\n`)) {
        commentId = comment.id;
      }
    });
    if (commentId) {
      await deleteComment(commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}

// Pull Request

async function getPrList() {
  logger.trace('getPrList()');
  if (!config.prList) {
    logger.debug('Retrieving PR list');
    const res = await get(
      `repos/${config.parentRepo ||
        config.repository}/pulls?per_page=100&state=all`,
      { paginate: true }
    );
    config.prList = res.body.map(pr => ({
      number: pr.number,
      branchName: pr.head.ref,
      sha: pr.head.sha,
      title: pr.title,
      state:
        pr.state === 'closed' && pr.merged_at && pr.merged_at.length
          ? 'merged'
          : pr.state,
      createdAt: pr.created_at,
      closed_at: pr.closed_at,
      sourceRepo: pr.head && pr.head.repo ? pr.head.repo.full_name : undefined,
    }));
    logger.debug(`Retrieved ${config.prList.length} Pull Requests`);
  }
  return config.prList;
}

function matchesState(state, desiredState) {
  if (desiredState === 'all') {
    return true;
  }
  if (desiredState[0] === '!') {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find(
    p =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr;
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
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  // Include the repository owner to handle forkMode and regular mode
  const head = `${config.repository.split('/')[0]}:${branchName}`;
  const options = {
    body: {
      title,
      head,
      base,
      body,
    },
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
    options.body.maintainer_can_modify = true;
  }
  logger.debug({ title, head, base }, 'Creating PR');
  const pr = (await get.post(
    `repos/${config.parentRepo || config.repository}/pulls`,
    options
  )).body;
  logger.debug({ branch: branchName, pr: pr.number }, 'PR created');
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  pr.displayNumber = `Pull Request #${pr.number}`;
  pr.branchName = branchName;
  await addLabels(pr.number, labels);
  if (statusCheckVerify) {
    logger.debug('Setting statusCheckVerify');
    await setBranchStatus(
      branchName,
      `${appSlug}/verify`,
      `${appName} verified pull request`,
      'success',
      urls.homepage
    );
  }
  return pr;
}

async function getOpenPrs() {
  // istanbul ignore if
  if (config.isGhe) {
    logger.debug(
      'Skipping unsupported graphql PullRequests.mergeStateStatus query on GHE'
    );
    return {};
  }
  if (!config.openPrList) {
    config.openPrList = {};
    let query;
    try {
      const url = 'graphql';
      // https://developer.github.com/v4/previews/#mergeinfopreview---more-detailed-information-about-a-pull-requests-merge-state
      const headers = {
        accept: 'application/vnd.github.merge-info-preview+json',
      };
      // prettier-ignore
      query = `
      query {
        repository(owner: "${config.repositoryOwner}", name: "${config.repositoryName}") {
          pullRequests(states: [OPEN], first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              headRefName
              title
              mergeable
              mergeStateStatus
              labels(last: 100) {
                nodes {
                  name
                }
              }
              commits(first: 2) {
                nodes {
                  commit {
                    author {
                      email
                    }
                    committer {
                      email
                    }
                    parents(last: 1) {
                      edges {
                        node {
                          abbreviatedOid
                          oid
                        }
                      }
                    }
                  }
                }
              }
              body
              reviews(first: 1, states:[CHANGES_REQUESTED]){
                nodes{
                  state
                }
              }
            }
          }
        }
      }
      `;
      const options = {
        headers,
        body: JSON.stringify({ query }),
        json: false,
      };
      const res = JSON.parse((await get.post(url, options)).body);
      const prNumbers = [];
      // istanbul ignore if
      if (!res.data) {
        logger.info({ query, res }, 'No graphql res.data');
        return {};
      }
      for (const pr of res.data.repository.pullRequests.nodes) {
        // https://developer.github.com/v4/object/pullrequest/
        pr.displayNumber = `Pull Request #${pr.number}`;
        pr.state = 'open';
        pr.branchName = pr.headRefName;
        delete pr.headRefName;
        // https://developer.github.com/v4/enum/mergeablestate
        const canMergeStates = ['BEHIND', 'CLEAN'];
        const hasNegativeReview =
          pr.reviews && pr.reviews.nodes && pr.reviews.nodes.length > 0;
        pr.canMerge =
          canMergeStates.includes(pr.mergeStateStatus) && !hasNegativeReview;
        // https://developer.github.com/v4/enum/mergestatestatus
        if (pr.mergeStateStatus === 'DIRTY') {
          pr.isConflicted = true;
        } else {
          pr.isConflicted = false;
        }
        if (pr.commits.nodes.length === 1) {
          if (config.gitAuthor) {
            // Check against gitAuthor
            const commitAuthorEmail = pr.commits.nodes[0].commit.author.email;
            if (commitAuthorEmail === config.gitAuthor.address) {
              pr.canRebase = true;
            } else {
              pr.canRebase = false;
            }
          } else {
            // assume the author is us
            // istanbul ignore next
            pr.canRebase = true;
          }
        } else {
          // assume we can't rebase if more than 1
          pr.canRebase = false;
        }
        pr.isStale = false;
        if (pr.mergeStateStatus === 'BEHIND') {
          pr.isStale = true;
        } else {
          const baseCommitSHA = await getBaseCommitSHA();
          if (
            pr.commits.nodes[0].commit.parents.edges.length &&
            pr.commits.nodes[0].commit.parents.edges[0].node.oid !==
              baseCommitSHA
          ) {
            pr.isStale = true;
          }
        }
        if (pr.labels) {
          pr.labels = pr.labels.nodes.map(label => label.name);
        }
        delete pr.mergeable;
        delete pr.mergeStateStatus;
        delete pr.commits;
        config.openPrList[pr.number] = pr;
        prNumbers.push(pr.number);
      }
      prNumbers.sort();
      logger.trace({ prNumbers }, 'Retrieved open PR list with graphql');
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ query, err }, 'getOpenPrs error');
    }
  }
  return config.openPrList;
}

async function getClosedPrs() {
  // istanbul ignore if
  if (config.isGhe) {
    logger.debug(
      'Skipping unsupported graphql PullRequests.mergeStateStatus query on GHE'
    );
    return {};
  }
  if (!config.closedPrList) {
    config.closedPrList = {};
    let query;
    try {
      const url = 'graphql';
      // prettier-ignore
      query = `
      query {
        repository(owner: "${config.repositoryOwner}", name: "${config.repositoryName}") {
          pullRequests(states: [CLOSED, MERGED], first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              state
              headRefName
              title
              comments(last: 100) {
                nodes {
                  databaseId
                  body
                }
              }
            }
          }
        }
      }
      `;
      const options = {
        body: JSON.stringify({ query }),
        json: false,
      };
      const res = JSON.parse((await get.post(url, options)).body);
      const prNumbers = [];
      // istanbul ignore if
      if (!res.data) {
        logger.info(
          { query, res },
          'No graphql res.data, returning empty list'
        );
        return {};
      }
      for (const pr of res.data.repository.pullRequests.nodes) {
        // https://developer.github.com/v4/object/pullrequest/
        pr.displayNumber = `Pull Request #${pr.number}`;
        pr.state = pr.state.toLowerCase();
        pr.branchName = pr.headRefName;
        delete pr.headRefName;
        pr.comments = pr.comments.nodes.map(comment => ({
          id: comment.databaseId,
          body: comment.body,
        }));
        pr.body = 'dummy body'; // just in case
        config.closedPrList[pr.number] = pr;
        prNumbers.push(pr.number);
      }
      prNumbers.sort();
      logger.debug({ prNumbers }, 'Retrieved closed PR list with graphql');
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ query, err }, 'getClosedPrs error');
    }
  }
  return config.closedPrList;
}

// Gets details for a PR
async function getPr(prNo) {
  if (!prNo) {
    return null;
  }
  const openPr = (await getOpenPrs())[prNo];
  if (openPr) {
    logger.debug('Returning from graphql open PR list');
    return openPr;
  }
  const closedPr = (await getClosedPrs())[prNo];
  if (closedPr) {
    logger.debug('Returning from graphql closed PR list');
    return closedPr;
  }
  logger.info(
    { prNo },
    'PR not found in open or closed PRs list - trying to fetch it directly'
  );
  const pr = (await get(
    `repos/${config.parentRepo || config.repository}/pulls/${prNo}`
  )).body;
  if (!pr) {
    return null;
  }
  // Harmonise PR values
  pr.displayNumber = `Pull Request #${pr.number}`;
  if (pr.state === 'open') {
    pr.branchName = pr.head ? pr.head.ref : undefined;
    pr.sha = pr.head ? pr.head.sha : undefined;
    if (pr.mergeable === true) {
      pr.canMerge = true;
    }
    if (pr.mergeable_state === 'dirty') {
      logger.debug({ prNo }, 'PR state is dirty so unmergeable');
      pr.isConflicted = true;
    }
    if (pr.commits === 1) {
      if (config.gitAuthor) {
        // Check against gitAuthor
        const commitAuthorEmail = (await get(
          `repos/${config.parentRepo ||
            config.repository}/pulls/${prNo}/commits`
        )).body[0].commit.author.email;
        if (commitAuthorEmail === config.gitAuthor.address) {
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
      // Check if only one author of all commits
      logger.debug({ prNo }, 'Checking all commits');
      const prCommits = (await get(
        `repos/${config.parentRepo || config.repository}/pulls/${prNo}/commits`
      )).body;
      // Filter out "Update branch" presses
      const remainingCommits = prCommits.filter(commit => {
        const isWebflow =
          commit.committer && commit.committer.login === 'web-flow';
        if (!isWebflow) {
          // Not a web UI commit, so keep it
          return true;
        }
        const isUpdateBranch =
          commit.commit &&
          commit.commit.message &&
          commit.commit.message.startsWith("Merge branch 'master' into");
        if (isUpdateBranch) {
          // They just clicked the button
          return false;
        }
        // They must have done some other edit through the web UI
        return true;
      });
      if (remainingCommits.length <= 1) {
        pr.canRebase = true;
      }
    }
    const baseCommitSHA = await getBaseCommitSHA();
    if (!pr.base || pr.base.sha !== baseCommitSHA) {
      pr.isStale = true;
    }
  }
  return pr;
}

// Return a list of all modified files in a PR
async function getPrFiles(prNo) {
  logger.debug({ prNo }, 'getPrFiles');
  if (!prNo) {
    return [];
  }
  const files = (await get(
    `repos/${config.parentRepo || config.repository}/pulls/${prNo}/files`
  )).body;
  return files.map(f => f.filename);
}

async function updatePr(prNo, title, body) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const patchBody = { title };
  if (body) {
    patchBody.body = body;
  }
  const options = {
    body: patchBody,
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
  }
  await get.patch(
    `repos/${config.parentRepo || config.repository}/pulls/${prNo}`,
    options
  );
  logger.debug({ pr: prNo }, 'PR updated');
}

async function mergePr(prNo, branchName) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // istanbul ignore if
  if (config.pushProtection) {
    logger.info(
      { branch: branchName, prNo },
      'Branch protection: Cannot automerge PR when push protection is enabled'
    );
    return false;
  }
  // istanbul ignore if
  if (config.prReviewsRequired) {
    logger.debug(
      { branch: branchName, prNo },
      'Branch protection: Attempting to merge PR when PR reviews are enabled'
    );
    const repository = config.parentRepo || config.repository;
    const reviews = await get(`repos/${repository}/pulls/${prNo}/reviews`);
    const isApproved = reviews.body.some(review => review.state === 'APPROVED');
    if (!isApproved) {
      logger.info(
        { branch: branchName, prNo },
        'Branch protection: Cannot automerge PR until there is an approving review'
      );
      return false;
    }
    logger.debug('Found approving reviews');
  }
  const url = `repos/${config.parentRepo ||
    config.repository}/pulls/${prNo}/merge`;
  const options = {
    body: {},
  };
  let automerged = false;
  if (config.mergeMethod) {
    // This path is taken if we have auto-detected the allowed merge types from the repo
    options.body.merge_method = config.mergeMethod;
    try {
      logger.debug({ options, url }, `mergePr`);
      await get.put(url, options);
      automerged = true;
    } catch (err) {
      if (err.statusCode === 405) {
        // istanbul ignore next
        logger.info(
          { response: err.response ? err.response.body : undefined },
          'GitHub blocking PR merge -- will keep trying'
        );
      } else {
        logger.warn({ err }, `Failed to ${options.body.merge_method} PR`);
        return false;
      }
    }
  }
  if (!automerged) {
    // We need to guess the merge method and try squash -> rebase -> merge
    options.body.merge_method = 'rebase';
    try {
      logger.debug({ options, url }, `mergePr`);
      await get.put(url, options);
    } catch (err1) {
      logger.debug({ err: err1 }, `Failed to ${options.body.merge_method} PR`);
      try {
        options.body.merge_method = 'squash';
        logger.debug({ options, url }, `mergePr`);
        await get.put(url, options);
      } catch (err2) {
        logger.debug(
          { err: err2 },
          `Failed to ${options.body.merge_method} PR`
        );
        try {
          options.body.merge_method = 'merge';
          logger.debug({ options, url }, `mergePr`);
          await get.put(url, options);
        } catch (err3) {
          logger.debug(
            { err: err3 },
            `Failed to ${options.body.merge_method} PR`
          );
          logger.debug({ pr: prNo }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  logger.debug({ pr: prNo }, 'PR merged');
  // Update base branch SHA
  config.baseCommitSHA = null;
  // Delete branch
  await deleteBranch(branchName);
  return true;
}

// istanbul ignore next
function smartTruncate(input) {
  if (input.length < 60000) {
    return input;
  }
  const releaseNotesMatch = input.match(
    new RegExp(`### Release Notes.*### ${appName} configuration`, 'ms')
  );
  // istanbul ignore if
  if (releaseNotesMatch) {
    const divider = `</details>\n\n---\n\n### ${appName} configuration`;
    const [releaseNotes] = releaseNotesMatch;
    const nonReleaseNotesLength =
      input.length - releaseNotes.length - divider.length;
    const availableLength = 60000 - nonReleaseNotesLength;
    return input.replace(
      releaseNotes,
      releaseNotes.slice(0, availableLength) + divider
    );
  }
  return input.substring(0, 60000);
}

function getPrBody(input) {
  if (config.isGhe) {
    return smartTruncate(input);
  }
  const massagedInput = input
    // to be safe, replace all github.com links with renovatebot redirector
    .replace(/href="https?:\/\/github.com\//g, 'href="https://togithub.com/')
    .replace(/]\(https:\/\/github\.com\//g, '](https://togithub.com/')
    .replace(/]: https:\/\/github\.com\//g, ']: https://togithub.com/');
  return smartTruncate(massagedInput);
}

async function getVulnerabilityAlerts() {
  // istanbul ignore if
  if (config.isGhe) {
    logger.debug(
      'Skipping unsupported graphql vulnerabilityAlerts query on GHE'
    );
    return [];
  }
  const headers = {
    accept: 'application/vnd.github.vixen-preview+json',
  };
  const url = 'graphql';
  // prettier-ignore
  const query = `
  query {
    repository(owner:"${config.repositoryOwner}", name:"${config.repositoryName}") {
        vulnerabilityAlerts(last: 100) {
                edges {
                        node {
                                externalIdentifier
                                externalReference
                                packageName
                                affectedRange
                                fixedIn
                        }
                }
        }
    }
  }`;
  const options = {
    headers,
    body: JSON.stringify({ query }),
    json: false,
  };
  let alerts = [];
  try {
    const res = JSON.parse((await get.post(url, options)).body);
    if (res.data.repository.vulnerabilityAlerts) {
      alerts = res.data.repository.vulnerabilityAlerts.edges.map(
        edge => edge.node
      );
      if (alerts.length) {
        logger.info({ alerts }, 'Found GitHub vulnerability alerts');
      }
    } else {
      logger.debug('Cannot read vulnerability alerts');
    }
  } catch (err) {
    logger.info({ err }, 'Error retrieving vulnerability alerts');
  }
  return alerts;
}
