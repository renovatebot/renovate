const get = require('./gl-got-wrapper');
const addrs = require('email-addresses');

let config = {};

module.exports = {
  getRepos,
  initRepo,
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
  ensureIssue,
  ensureIssueClosing,
  addAssignees,
  addReviewers,
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
  // file
  commitFilesToBranch,
  getFile,
  // commits
  getCommitMessages,
};

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  logger.debug('getRepos(token, endpoint)');
  if (token) {
    process.env.GITLAB_TOKEN = token;
  } else if (!process.env.GITLAB_TOKEN) {
    throw new Error('No token found for getRepos');
  }
  if (endpoint) {
    process.env.GITLAB_ENDPOINT = endpoint;
  }
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

// Initialize GitLab by getting base branch
async function initRepo({ repository, token, endpoint }) {
  if (token) {
    process.env.GITLAB_TOKEN = token;
  } else if (!process.env.GITLAB_TOKEN) {
    throw new Error(`No token found for GitLab repository ${repository}`);
  }
  if (token) {
    process.env.GITLAB_TOKEN = token;
  }
  if (endpoint) {
    process.env.GITLAB_ENDPOINT = endpoint;
  }
  config = {};
  get.reset();
  config.repository = urlEscape(repository);
  try {
    const res = await get(`projects/${config.repository}`);
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    // Discover our user email
    config.email = (await get(`user`)).body.email;
    delete config.prList;
    delete config.fileList;
    await Promise.all([getPrList(), getFileList()]);
  } catch (err) {
    logger.error({ err }, `GitLab init error`);
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
    delete config.fileList;
    await getFileList(branchName);
  }
}

// Search

// Get full file list
async function getFileList(branchName = config.baseBranch) {
  if (config.fileList) {
    return config.fileList;
  }
  try {
    const res = await get(
      `projects/${
        config.repository
      }/repository/tree?ref=${branchName}&recursive=true&per_page=100`,
      { paginate: true }
    );
    config.fileList = res.body
      .filter(item => item.type === 'blob' && item.mode !== '120000')
      .map(item => item.path)
      .sort();
  } catch (err) {
    logger.info('Error retrieving git tree - no files detected');
    config.fileList = [];
  }
  return config.fileList;
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  try {
    const url = `projects/${config.repository}/repository/branches/${urlEscape(
      branchName
    )}`;
    const res = await get(url);
    if (res.statusCode === 200) {
      logger.debug('Branch exists');
      return true;
    }
    // This probably shouldn't happen
    logger.debug("Branch doesn't exist");
    return false;
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return false
      logger.debug("Branch doesn't exist");
      return false;
    }
    // Propagate if it's any other error
    throw error;
  }
}

async function getAllRenovateBranches(branchPrefix) {
  logger.debug(`getAllRenovateBranches(${branchPrefix})`);
  const allBranches = await get(
    `projects/${config.repository}/repository/branches`
  );
  return allBranches.body.reduce((arr, branch) => {
    if (branch.name.startsWith(branchPrefix)) {
      arr.push(branch.name);
    }
    return arr;
  }, []);
}

function isBranchStale() {
  logger.warn('Unimplemented in GitLab: isBranchStale');
  return false;
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  if (!await branchExists(branchName)) {
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
  // First, get the branch to find the commit SHA
  let url = `projects/${config.repository}/repository/branches/${urlEscape(
    branchName
  )}`;
  let res = await get(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${
    config.repository
  }/repository/commits/${branchSha}/statuses`;
  res = await get(url);
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
  // First, get the branch to find the commit SHA
  let url = `projects/${config.repository}/repository/branches/${urlEscape(
    branchName
  )}`;
  let res = await get(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${
    config.repository
  }/repository/commits/${branchSha}/statuses`;
  res = await get(url);
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
  // First, get the branch to find the commit SHA
  let url = `projects/${config.repository}/repository/branches/${urlEscape(
    branchName
  )}`;
  const res = await get(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${config.repository}/statuses/${branchSha}`;
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

async function deleteBranch(branchName, closePr = false) {
  if (closePr) {
    logger.debug('Closing PR');
    const pr = await getBranchPr(branchName);
    // istanbul ignore if
    if (pr) {
      await get.put(
        `projects/${config.repository}/merge_requests/${pr.number}`,
        {
          body: {
            state_event: 'close',
          },
        }
      );
    }
  }
  await get.delete(
    `projects/${config.repository}/repository/branches/${urlEscape(branchName)}`
  );
}

function mergeBranch() {
  logger.warn('Unimplemented in GitLab: mergeBranch');
}

async function getBranchLastCommitTime(branchName) {
  try {
    const res = await get(
      `projects/${config.repository}/repository/commits?ref_name=${urlEscape(
        branchName
      )}`
    );
    return new Date(res.body[0].committed_date);
  } catch (err) {
    logger.error({ err }, `getBranchLastCommitTime error`);
    return new Date();
  }
}

// Issue

function ensureIssue() {
  // istanbul ignore next
  logger.warn(`ensureIssue() is not implemented`);
}

function ensureIssueClosing() {}

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
  logger.error('No reviewer functionality in GitLab');
}

async function ensureComment() {
  // Todo: implement. See GitHub API for example
}

async function ensureCommentRemoval() {
  // Todo: implement. See GitHub API for example
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
      labels: Array.isArray(labels) ? labels.join(',') : null,
    },
  });
  const pr = res.body;
  pr.number = pr.iid;
  pr.branchName = branchName;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  return pr;
}

async function getPr(iid) {
  logger.debug(`getPr(${iid})`);
  const url = `projects/${config.repository}/merge_requests/${iid}`;
  const pr = (await get(url)).body;
  // Harmonize fields with GitHub
  pr.branchName = pr.source_branch;
  pr.number = pr.iid;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  pr.body = pr.description;
  if (pr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.canMerge = false;
    pr.isUnmergeable = true;
  } else {
    // Actually.. we can't be sure
    pr.canMerge = true;
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
    logger.warn({ err }, 'Error getting PR branch');
    pr.isUnmergeable = true;
  }
  return pr;
}

function getPrFiles() {
  // TODO
  return [];
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
  await get.put(`projects/${config.repository}/merge_requests/${iid}/merge`, {
    body: {
      should_remove_source_branch: true,
    },
  });
  return true;
}

// Generic File operations

async function getFile(filePath, branchName) {
  logger.debug(`getFile(filePath=${filePath}, branchName=${branchName})`);
  if (!branchName || branchName === config.baseBranch) {
    if (config.fileList && !config.fileList.includes(filePath)) {
      return null;
    }
  }
  try {
    const url = `projects/${config.repository}/repository/files/${urlEscape(
      filePath
    )}?ref=${branchName || config.baseBranch}`;
    const res = await get(url);
    return Buffer.from(res.body.content, 'base64').toString();
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  }
}

// Add a new commit, create branch if not existing
async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch,
  gitAuthor
) {
  logger.debug(
    `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
  );
  const opts = {
    body: {
      branch: branchName,
      commit_message: message,
      start_branch: parentBranch,
      actions: [],
    },
  };

  try {
    if (gitAuthor) {
      logger.debug({ gitAuthor }, 'Found gitAuthor');
      const { name, address } = addrs.parseOneAddress(gitAuthor);
      if (name && address) {
        opts.body.author_name = name;
        opts.body.author_email = address;
      }
    }
  } catch (err) {
    logger.warn({ gitAuthor }, 'Error parsing gitAuthor');
  }

  for (const file of files) {
    const action = {
      file_path: file.name,
      content: Buffer.from(file.contents).toString('base64'),
      encoding: 'base64',
    };
    action.action = (await getFile(file.name)) ? 'update' : 'create';
    opts.body.actions.push(action);
  }
  if (await branchExists(branchName)) {
    await deleteBranch(branchName);
  }
  await get.post(`projects/${config.repository}/repository/commits`, opts);
}

// GET /projects/:id/repository/commits
async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    const res = await get(`projects/${config.repository}/repository/commits`);
    return res.body.map(commit => commit.title);
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}
