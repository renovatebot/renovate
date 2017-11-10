const get = require('./gl-got-wrapper');

const { createFile, updateFile } = require('./helpers');

const config = {};

module.exports = {
  getRepos,
  initRepo,
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
  addAssignees,
  addReviewers,
  // Comments
  ensureComment,
  ensureCommentRemoval,
  // PR
  findPr,
  createPr,
  getPr,
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

// Initialize GitLab by getting base branch
async function initRepo(repoName, token, endpoint) {
  logger.debug(`initRepo(${repoName})`);
  if (token) {
    process.env.GITLAB_TOKEN = token;
  } else if (!process.env.GITLAB_TOKEN) {
    throw new Error(`No token found for GitLab repository ${repoName}`);
  }
  if (token) {
    process.env.GITLAB_TOKEN = token;
  }
  if (endpoint) {
    process.env.GITLAB_ENDPOINT = endpoint;
  }
  config.repoName = repoName.replace('/', '%2F');
  config.fileList = null;
  try {
    const res = await get(`projects/${config.repoName}`);
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repoName} default branch = ${config.baseBranch}`);
    // Discover our user email
    config.email = (await get(`user`)).body.email;
  } catch (err) {
    logger.error({ err }, `GitLab init error`);
    throw err;
  }
  return {};
}

function setBaseBranch(branchName) {
  if (branchName) {
    config.baseBranch = branchName;
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
      `projects/${config.repoName}/repository/tree?ref=${
        branchName
      }&recursive=true&per_page=100`,
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
    const url = `projects/${
      config.repoName
    }/repository/branches/${branchName.replace('/', '%2F')}`;
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

function getAllRenovateBranches() {
  logger.warn('Unimplemented in GitLab: getAllRenovateBranches');
  return [];
}

function isBranchStale() {
  logger.warn('Unimplemented in GitLab: isBranchStale');
  return false;
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const urlString = `projects/${
    config.repoName
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
  let url = `projects/${
    config.repoName
  }/repository/branches/${branchName.replace('/', '%2F')}`;
  let res = await get(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${config.repoName}/repository/commits/${branchSha}/statuses`;
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
      if (check.status === 'failed') {
        status = 'failure';
      } else if (check.status !== 'success') {
        ({ status } = check);
      }
    }
  });
  return status;
}

async function getBranchStatusCheck(branchName, context) {
  // First, get the branch to find the commit SHA
  let url = `projects/${
    config.repoName
  }/repository/branches/${branchName.replace('/', '%2F')}`;
  let res = await get(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${config.repoName}/repository/commits/${branchSha}/statuses`;
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
  let url = `projects/${
    config.repoName
  }/repository/branches/${branchName.replace('/', '%2F')}`;
  const res = await get(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${config.repoName}/statuses/${branchSha}`;
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

async function deleteBranch(branchName) {
  await get.delete(
    `projects/${config.repoName}/repository/branches/${branchName.replace(
      '/',
      '%2F'
    )}`
  );
}

function mergeBranch() {
  logger.warn('Unimplemented in GitLab: mergeBranch');
}

async function getBranchLastCommitTime(branchName) {
  try {
    const res = await get(
      `projects/${config.repoName}/repository/commits?ref_name=${branchName}`
    );
    return new Date(res.body[0].committed_date);
  } catch (err) {
    logger.error({ err }, `getBranchLastCommitTime error`);
    return new Date();
  }
}

// Issue

async function addAssignees(iid, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${iid}`);
  if (assignees.length > 1) {
    logger.warn('Cannot assign more than one assignee to Merge Requests');
  }
  try {
    const assigneeId = (await get(`users?username=${assignees[0]}`)).body[0].id;
    let url = `projects/${config.repoName}/merge_requests/${iid}`;
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

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=${
    state
  }&per_page=100`;
  const res = await get(urlString, { paginated: true });
  let pr = null;
  res.body.forEach(result => {
    if (
      (!prTitle || result.title === prTitle) &&
      result.source_branch === branchName
    ) {
      pr = result;
      // GitHub uses number, GitLab uses iid
      pr.number = pr.iid;
      pr.body = pr.description;
      pr.displayNumber = `Merge Request #${pr.iid}`;
      if (pr.state !== 'opened') {
        pr.isClosed = true;
      }
    }
  });
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
  const targetBranch = useDefaultBranch
    ? config.defaultBranch
    : config.baseBranch;
  logger.debug(`Creating Merge Request: ${title}`);
  const res = await get.post(`projects/${config.repoName}/merge_requests`, {
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
  pr.displayNumber = `Merge Request #${pr.iid}`;
  return pr;
}

async function getPr(iid) {
  logger.debug(`getPr(${iid})`);
  const url = `projects/${config.repoName}/merge_requests/${iid}`;
  const pr = (await get(url)).body;
  // Harmonize fields with GitHub
  pr.number = pr.iid;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  pr.body = pr.description;
  if (pr.state === 'closed' || pr.state === 'merged') {
    logger.debug('pr is closed');
    pr.isClosed = true;
  }
  if (pr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.isUnmergeable = true;
  }
  // Check if the most recent branch commit is by us
  // If not then we don't allow it to be rebased, in case someone's changes would be lost
  const branchUrl = `projects/${
    config.repoName
  }/repository/branches/${pr.source_branch.replace('/', '%2F')}`;
  const branch = (await get(branchUrl)).body;
  if (branch && branch.commit && branch.commit.author_email === config.email) {
    pr.canRebase = true;
  }
  return pr;
}

async function updatePr(iid, title, description) {
  await get.put(`projects/${config.repoName}/merge_requests/${iid}`, {
    body: {
      title,
      description,
    },
  });
}

async function mergePr(iid) {
  await get.put(`projects/${config.repoName}/merge_requests/${iid}/merge`, {
    body: {
      should_remove_source_branch: true,
    },
  });
  return true;
}

// Generic File operations

async function getFile(filePath, branchName) {
  try {
    const url = `projects/${
      config.repoName
    }/repository/files/${filePath.replace(/\//g, '%2F')}?ref=${branchName ||
      config.baseBranch}`;
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
  parentBranch = config.baseBranch
) {
  logger.debug(
    `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
  );
  if (branchName !== parentBranch) {
    const isBranchExisting = await branchExists(branchName);
    if (isBranchExisting) {
      logger.debug(`Branch ${branchName} already exists`);
    } else {
      logger.debug(`Creating branch ${branchName}`);
      const opts = {
        body: {
          branch: branchName,
          ref: config.baseBranch,
        },
      };
      await get.post(`projects/${config.repoName}/repository/branches`, opts);
    }
  }
  for (const file of files) {
    const existingFile = await getFile(file.name, branchName);
    if (existingFile) {
      logger.debug(`${file.name} exists - updating it`);
      await updateFile(
        config.repoName,
        branchName,
        file.name,
        file.contents,
        message
      );
    } else {
      logger.debug(`Creating file ${file.name}`);
      await createFile(
        config.repoName,
        branchName,
        file.name,
        file.contents,
        message
      );
    }
  }
}

// GET /projects/:id/repository/commits
async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    const res = await get(`projects/${config.repoName}/repository/commits`);
    return res.body.map(commit => commit.title);
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}
