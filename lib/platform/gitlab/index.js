const URL = require('url');
const is = require('@sindresorhus/is');
const addrs = require('email-addresses');

const get = require('./gl-got-wrapper');
const hostRules = require('../../util/host-rules');
const GitStorage = require('../git/storage');
const Storage = require('./storage');

let config = {
  storage: new Storage(),
};

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
  logger.info('Autodiscovering GitLab repositories');
  logger.debug('getRepos(token, endpoint)');
  const opts = hostRules.find({ platform: 'gitlab' }, { token, endpoint });
  if (!opts.token) {
    throw new Error('No token found for getRepos');
  }
  hostRules.update({ ...opts, platform: 'gitlab', default: true });
  try {
    const url = `projects?membership=true&per_page=100`;
    const res = await get(url, { paginate: true });
    logger.info(`Discovered ${res.body.length} project(s)`);
    return res.body.map(repo => repo.path_with_namespace);
  } catch (err) {
    logger.error({ err }, `GitLab getRepos error`);
    throw err;
  }
}

function urlEscape(str) {
  return str ? str.replace(/\//g, '%2F') : str;
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

// Initialize GitLab by getting base branch
async function initRepo({
  repository,
  token,
  endpoint,
  gitAuthor,
  gitFs,
  localDir,
}) {
  const opts = hostRules.find({ platform: 'gitlab' }, { token, endpoint });
  if (!opts.token) {
    throw new Error(`No token found for GitLab repository ${repository}`);
  }
  hostRules.update({ ...opts, platform: 'gitlab', default: true });
  config = {};
  get.reset();
  config.repository = urlEscape(repository);
  config.gitFs = gitFs;
  config.localDir = localDir;
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
  let res;
  try {
    res = await get(`projects/${config.repository}`);
    if (res.body.archived) {
      logger.info(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error('archived');
    }
    if (res.body.default_branch === null) {
      throw new Error('empty');
    }
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    // Discover our user email
    config.email = (await get(`user`)).body.email;
    delete config.prList;
    // istanbul ignore if
    if (config.gitFs) {
      logger.debug('Enabling Git FS');
      const { host } = URL.parse(opts.endpoint);
      const url = GitStorage.getUrl({
        gitFs,
        auth: 'oauth2:' + opts.token,
        hostname: host || 'gitlab.com',
        repository,
      });
      config.storage = new GitStorage();
      await config.storage.initRepo({
        ...config,
        url,
      });
    } else {
      config.storage = new Storage();
      await config.storage.initRepo(config);
    }
    await Promise.all([getPrList(), getFileList()]);
  } catch (err) /* istanbul ignore next */ {
    logger.debug('Caught initRepo error');
    if (err.message.includes('HEAD is not a symbolic ref')) {
      throw new Error('empty');
    }
    if (['archived', 'empty'].includes(err.message)) {
      throw err;
    }
    if (err.statusCode === 403) {
      throw new Error('forbidden');
    }
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown GitLab initRepo error');
    throw err;
  }
  return {};
}

function getRepoForceRebase() {
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
  logger.debug(`getBranchPr(${branchName})`);
  if (!(await branchExists(branchName))) {
    return null;
  }
  const urlString = `projects/${
    config.repository
  }/merge_requests?state=opened&per_page=100`;
  const res = await get(urlString, { paginate: true });
  logger.debug(`Got res with ${res.body.length} results`);
  let pr = null;
  res.body.forEach(result => {
    if (result.source_branch === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  return getPr(pr.iid);
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
  // GitLab does not support push with GitFs token
  // See https://gitlab.com/gitlab-org/gitlab-ce/issues/18106
  let storage = config.storage;
  // istanbul ignore if
  if (config.gitFs === 'http' || config.gitFs === 'https') {
    storage = new Storage();
    storage.initRepo(config);
  }
  const res = await storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
  if (config.gitFs !== 'ssh') {
    // Reopen PR if it previousluy existed and was closed by GitLab when we deleted branch
    const pr = await getBranchPr(branchName);
    // istanbul ignore if
    if (pr) {
      logger.debug('Reopening PR');
      await reopenPr(pr.number);
      // Close and repoen MR again due to known GitLab bug https://gitlab.com/gitlab-org/gitlab-ce/issues/41545
      await closePr(pr.number);
      await reopenPr(pr.number);
    }
  }
  return res;
}

function getFile(filePath, branchName) {
  return config.storage.getFile(filePath, branchName);
}

async function deleteBranch(branchName, shouldClosePr = false) {
  if (shouldClosePr) {
    logger.debug('Closing PR');
    const pr = await getBranchPr(branchName);
    // istanbul ignore if
    if (pr) {
      await closePr(pr.number);
    }
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
async function getBranchStatus(branchName, requiredStatusChecks) {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    return 'success';
  }
  if (requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return 'failed';
  }
  // First, get the branch commit SHA
  const branchSha = await config.storage.getBranchCommit(branchName);
  // Now, check the statuses for that commit
  const url = `projects/${
    config.repository
  }/repository/commits/${branchSha}/statuses`;
  const res = await get(url);
  logger.debug(`Got res with ${res.body.length} results`);
  if (res.body.length === 0) {
    // Return 'pending' if we have no status checks
    return 'pending';
  }
  let status = 'success';
  // Return 'success' if all are success
  res.body.forEach(check => {
    // If one is failed then don't overwrite that
    if (status !== 'failure') {
      if (!check.allow_failure) {
        if (check.status === 'failed') {
          status = 'failure';
        } else if (check.status !== 'success') {
          ({ status } = check);
        }
      }
    }
  });
  return status;
}

async function getBranchStatusCheck(branchName, context) {
  // First, get the branch commit SHA
  const branchSha = await config.storage.getBranchCommit(branchName);
  // Now, check the statuses for that commit
  const url = `projects/${
    config.repository
  }/repository/commits/${branchSha}/statuses`;
  // cache-bust in case we have rebased
  const res = await get(url, { useCache: false });
  logger.debug(`Got res with ${res.body.length} results`);
  for (const check of res.body) {
    if (check.name === context) {
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
  // First, get the branch commit SHA
  const branchSha = await config.storage.getBranchCommit(branchName);
  // Now, check the statuses for that commit
  const url = `projects/${config.repository}/statuses/${branchSha}`;
  const options = {
    state,
    description,
    context,
  };
  if (targetUrl) {
    options.target_url = targetUrl;
  }
  try {
    await get.post(url, { body: options });
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err });
    logger.warn('Failed to set branch status');
  }
}

// Issue

async function getIssueList() {
  if (!config.issueList) {
    const res = await get(`projects/${config.repository}/issues?state=opened`, {
      useCache: false,
    });
    // istanbul ignore if
    if (!is.array(res.body)) {
      logger.warn({ responseBody: res.body }, 'Could not retrieve issue list');
      return [];
    }
    config.issueList = res.body.map(i => ({
      iid: i.iid,
      title: i.title,
    }));
  }
  return config.issueList;
}

async function findIssue(title) {
  logger.debug(`findIssue(${title})`);
  try {
    const issueList = await getIssueList();
    const issue = issueList.find(i => i.title === title);
    if (!issue) {
      return null;
    }
    const issueBody = (await get(
      `projects/${config.repository}/issues/${issue.iid}`
    )).body.description;
    return {
      number: issue.iid,
      body: issueBody,
    };
  } catch (err) /* istanbul ignore next */ {
    logger.warn('Error finding issue');
    return null;
  }
}

async function ensureIssue(title, body) {
  logger.debug(`ensureIssue()`);
  const description = getPrBody(body);
  try {
    const issueList = await getIssueList();
    const issue = issueList.find(i => i.title === title);
    if (issue) {
      const existingDescription = (await get(
        `projects/${config.repository}/issues/${issue.iid}`
      )).body.description;
      if (existingDescription !== description) {
        logger.debug('Updating issue body');
        await get.put(`projects/${config.repository}/issues/${issue.iid}`, {
          body: { description },
        });
        return 'updated';
      }
    } else {
      await get.post(`projects/${config.repository}/issues`, {
        body: {
          title,
          description,
        },
      });
      // delete issueList so that it will be refetched as necessary
      delete config.issueList;
      return 'created';
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Issues are disabled for this repo')) {
      logger.info(`Could not create issue: ${err.message}`);
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

async function ensureIssueClosing(title) {
  logger.debug(`ensureIssueClosing()`);
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.title === title) {
      logger.info({ issue }, 'Closing issue');
      await get.put(`projects/${config.repository}/issues/${issue.iid}`, {
        body: { state_event: 'close' },
      });
    }
  }
}

async function addAssignees(iid, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${iid}`);
  if (assignees.length > 1) {
    logger.warn('Cannot assign more than one assignee to Merge Requests');
  }
  try {
    const assigneeId = (await get(`users?username=${assignees[0]}`)).body[0].id;
    let url = `projects/${config.repository}/merge_requests/${iid}`;
    url += `?assignee_id=${assigneeId}`;
    await get.put(url);
  } catch (err) {
    logger.error({ iid, assignees }, 'Failed to add assignees');
  }
}

function addReviewers(iid, reviewers) {
  logger.debug(`addReviewers('${iid}, '${reviewers})`);
  logger.warn('Unimplemented in GitLab: approvals');
}

async function deleteLabel(issueNo, label) {
  logger.debug(`Deleting label ${label} from #${issueNo}`);
  try {
    const pr = await getPr(issueNo);
    const labels = (pr.labels || []).filter(l => l !== label).join();
    await get.put(`projects/${config.repository}/merge_requests/${issueNo}`, {
      body: { labels },
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, issueNo, label }, 'Failed to delete label');
  }
}

async function getComments(issueNo) {
  // GET projects/:owner/:repo/merge_requests/:number/notes
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `projects/${config.repository}/merge_requests/${issueNo}/notes`;
  const comments = (await get(url, { paginate: true })).body;
  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(issueNo, body) {
  // POST projects/:owner/:repo/merge_requests/:number/notes
  await get.post(
    `projects/${config.repository}/merge_requests/${issueNo}/notes`,
    {
      body: { body },
    }
  );
}

async function editComment(issueNo, commentId, body) {
  // PUT projects/:owner/:repo/merge_requests/:number/notes/:id
  await get.put(
    `projects/${
      config.repository
    }/merge_requests/${issueNo}/notes/${commentId}`,
    {
      body: { body },
    }
  );
}

async function deleteComment(issueNo, commentId) {
  // DELETE projects/:owner/:repo/merge_requests/:number/notes/:id
  await get.delete(
    `projects/${config.repository}/merge_requests/${issueNo}/notes/${commentId}`
  );
}

async function ensureComment(issueNo, topic, content) {
  const massagedTopic = topic
    ? topic.replace(/Pull Request/g, 'Merge Request').replace(/PR/g, 'MR')
    : topic;
  const comments = await getComments(issueNo);
  let body;
  let commentId;
  let commentNeedsUpdating;
  if (topic) {
    logger.debug(`Ensuring comment "${massagedTopic}" in #${issueNo}`);
    body = `### ${topic}\n\n${content}`;
    body = body.replace(/Pull Request/g, 'Merge Request').replace(/PR/g, 'MR');
    comments.forEach(comment => {
      if (comment.body.startsWith(`### ${massagedTopic}\n\n`)) {
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
    logger.info({ repository: config.repository, issueNo }, 'Added comment');
  } else if (commentNeedsUpdating) {
    await editComment(issueNo, commentId, body);
    logger.info({ repository: config.repository, issueNo }, 'Updated comment');
  } else {
    logger.debug('Comment is already update-to-date');
  }
}

async function ensureCommentRemoval(issueNo, topic) {
  logger.debug(`Ensuring comment "${topic}" in #${issueNo} is removed`);
  const comments = await getComments(issueNo);
  let commentId;
  comments.forEach(comment => {
    if (comment.body.startsWith(`### ${topic}\n\n`)) {
      commentId = comment.id;
    }
  });
  if (commentId) {
    await deleteComment(issueNo, commentId);
  }
}

async function getPrList() {
  if (!config.prList) {
    const urlString = `projects/${
      config.repository
    }/merge_requests?per_page=100`;
    const res = await get(urlString, { paginate: true });
    config.prList = res.body.map(pr => ({
      number: pr.iid,
      branchName: pr.source_branch,
      title: pr.title,
      state: pr.state === 'opened' ? 'open' : pr.state,
      createdAt: pr.created_at,
    }));
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
  return prList.find(
    p =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
}

// Pull Request

async function createPr(
  branchName,
  title,
  description,
  labels,
  useDefaultBranch
) {
  const targetBranch = useDefaultBranch
    ? config.defaultBranch
    : config.baseBranch;
  logger.debug(`Creating Merge Request: ${title}`);
  const res = await get.post(`projects/${config.repository}/merge_requests`, {
    body: {
      source_branch: branchName,
      target_branch: targetBranch,
      remove_source_branch: true,
      title,
      description,
      labels: is.array(labels) ? labels.join(',') : null,
    },
  });
  const pr = res.body;
  pr.number = pr.iid;
  pr.branchName = branchName;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  return pr;
}

async function getPr(iid) {
  logger.debug(`getPr(${iid})`);
  const url = `projects/${
    config.repository
  }/merge_requests/${iid}?include_diverged_commits_count=1`;
  const pr = (await get(url)).body;
  // Harmonize fields with GitHub
  pr.branchName = pr.source_branch;
  pr.number = pr.iid;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  pr.body = pr.description;
  pr.isStale = pr.diverged_commits_count > 0;
  pr.state = pr.state === 'opened' ? 'open' : pr.state;
  if (pr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.canMerge = false;
    pr.isConflicted = true;
  } else if (pr.state === 'open') {
    const branchStatus = await getBranchStatus(pr.branchName, []);
    if (branchStatus === 'success') {
      pr.canMerge = true;
    }
  }
  // Check if the most recent branch commit is by us
  // If not then we don't allow it to be rebased, in case someone's changes would be lost
  const branchUrl = `projects/${
    config.repository
  }/repository/branches/${urlEscape(pr.source_branch)}`;
  try {
    const branch = (await get(branchUrl)).body;
    if (
      branch &&
      branch.commit &&
      branch.commit.author_email === config.email
    ) {
      pr.canRebase = true;
    }
  } catch (err) {
    if (pr.state === 'open' || err.statusCode !== 404) {
      logger.warn({ err }, 'Error getting PR branch');
      pr.isConflicted = true;
    }
  }
  return pr;
}

// Return a list of all modified files in a PR
async function getPrFiles(mrNo) {
  logger.debug({ mrNo }, 'getPrFiles');
  if (!mrNo) {
    return [];
  }
  const files = (await get(
    `projects/${config.repository}/merge_requests/${mrNo}/changes`
  )).body.changes;
  return files.map(f => f.new_path);
}

// istanbul ignore next
async function reopenPr(iid) {
  await get.put(`projects/${config.repository}/merge_requests/${iid}`, {
    body: {
      state_event: 'reopen',
    },
  });
}

// istanbul ignore next
async function closePr(iid) {
  await get.put(`projects/${config.repository}/merge_requests/${iid}`, {
    body: {
      state_event: 'close',
    },
  });
}

async function updatePr(iid, title, description) {
  await get.put(`projects/${config.repository}/merge_requests/${iid}`, {
    body: {
      title,
      description,
    },
  });
}

async function mergePr(iid) {
  try {
    await get.put(`projects/${config.repository}/merge_requests/${iid}/merge`, {
      body: {
        should_remove_source_branch: true,
      },
    });
    return true;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 401) {
      logger.info('No permissions to merge PR');
      return false;
    }
    if (err.statusCode === 406) {
      logger.info('PR not acceptable for merging');
      return false;
    }
    logger.debug({ err }, 'merge PR error');
    logger.info('PR merge failed');
    return false;
  }
}

function getPrBody(input) {
  return input
    .replace(/Pull Request/g, 'Merge Request')
    .replace(/PR/g, 'MR')
    .replace(/\]\(\.\.\/pull\//g, '](../merge_requests/');
}

function getCommitMessages() {
  return config.storage.getCommitMessages();
}

function getVulnerabilityAlerts() {
  return [];
}
