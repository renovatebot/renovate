let logger = require('../logger');
const glGot = require('gl-got');

const config = {};

module.exports = {
  getRepos,
  initRepo,
  setBaseBranch,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  createBranch,
  getBranch,
  getBranchPr,
  getBranchStatus,
  getBranchStatusCheck,
  setBranchStatus,
  deleteBranch,
  getBranchLastCommitTime,
  // issue
  addAssignees,
  addReviewers,
  addLabels,
  // PR
  findPr,
  checkForClosedPr,
  createPr,
  getPr,
  updatePr,
  mergePr,
  // file
  getSubDirectories,
  commitFilesToBranch,
  getFile,
  getFileContent,
  getFileJson,
  createFile,
  updateFile,
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
    let projects = [];
    const perPage = 100;
    let i = 1;
    let res;
    do {
      const url = `projects?membership=true&per_page=100&page=${i}`;
      res = await glGot(url);
      projects = projects.concat(
        res.body.map(repo => repo.path_with_namespace)
      );
      i += 1;
    } while (res.body.length === perPage);
    logger.info(`Discovered ${projects.length} project(s)`);
    return projects;
  } catch (err) {
    logger.error({ err }, `GitLab getRepos error`);
    throw err;
  }
}

// Initialize GitLab by getting base branch
async function initRepo(repoName, token, endpoint, repoLogger) {
  if (repoLogger) {
    logger = repoLogger;
  }
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
  try {
    logger.debug(`Determining Gitlab API version`);
    // projects/owned route deprecated in v4
    await glGot(`projects/owned`);
    config.apiVersion = 'v3';
  } catch (err) {
    config.apiVersion = 'v4';
  }
  logger.debug(`Detected Gitlab API ${config.apiVersion}`);
  config.repoName = repoName.replace('/', '%2F');
  try {
    const res = await glGot(`projects/${config.repoName}`);
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repoName} default branch = ${config.baseBranch}`);
    // Discover our user email
    config.email = (await glGot(`user`)).body.email;
  } catch (err) {
    logger.error({ err }, `GitLab init error`);
    throw err;
  }
  return {};
}

async function setBaseBranch(branchName) {
  if (branchName) {
    config.baseBranch = branchName;
  }
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths() {
  logger.debug("Can't find multiple package.json files in GitLab");
  return [];
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  try {
    const url = `projects/${config.repoName}/repository/branches/${branchName}`;
    const res = await glGot(url);
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

// Returns branch object
async function getBranch(branchName) {
  logger.debug(`getBranch(${branchName})`);
  const url = `projects/${config.repoName}/repository/branches/${branchName}`;
  try {
    return (await glGot(url)).body;
  } catch (err) {
    logger.warn({ err }, `Failed to getBranch ${branchName}`);
    return null;
  }
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=opened`;
  const res = await glGot(urlString);
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
  return getPr(config.apiVersion === 'v3' ? pr.id : pr.iid);
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
  let url = `projects/${config.repoName}/repository/branches/${branchName}`;
  let res = await glGot(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${config.repoName}/repository/commits/${branchSha}/statuses`;
  res = await glGot(url);
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
        status = check.status;
      }
    }
  });
  return status;
}

async function getBranchStatusCheck(branchName, context) {
  // First, get the branch to find the commit SHA
  let url = `projects/${config.repoName}/repository/branches/${branchName}`;
  let res = await glGot(url);
  const branchSha = res.body.commit.id;
  // Now, check the statuses for that commit
  url = `projects/${config.repoName}/repository/commits/${branchSha}/statuses`;
  res = await glGot(url);
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
  let url = `projects/${config.repoName}/repository/branches/${branchName}`;
  const res = await glGot(url);
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
  await glGot.post(url, { body: options });
}

async function deleteBranch(branchName) {
  await glGot.delete(
    `projects/${config.repoName}/repository/branches/${branchName}`
  );
}

async function getBranchLastCommitTime(branchName) {
  try {
    const res = await glGot(
      `projects/${config.repoName}/repository/commits?ref_name=${branchName}`
    );
    return new Date(res.body[0].committed_date);
  } catch (err) {
    logger.error({ err }, `getBranchLastCommitTime error`);
    return new Date();
  }
}

// Issue

async function addAssignees(prNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${prNo}`);
  if (assignees.length > 1) {
    logger.error('Cannot assign more than one assignee to Merge Requests');
  }
  let url = `projects/${config.repoName}/merge_requests/${prNo}`;
  url = `${url}?assignee_id=${assignees[0]}`;
  await glGot.put(url);
}

async function addReviewers(prNo, reviewers) {
  logger.debug(`addReviewers('${prNo}, '${reviewers})`);
  logger.error('No reviewer functionality in GitLab');
}

async function addLabels(prNo, labels) {
  logger.debug(`Adding labels ${labels} to #${prNo}`);
  let url = `projects/${config.repoName}/merge_requests/${prNo}`;
  url = `${url}?labels=${labels.join(',')}`;
  await glGot.put(url);
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=${state}`;
  const res = await glGot(urlString);
  let pr = null;
  res.body.forEach(result => {
    if (
      (!prTitle || result.title === prTitle) &&
      result.source_branch === branchName
    ) {
      pr = result;
      // GitHub uses number, GitLab uses iid
      pr.number = pr.id;
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
async function checkForClosedPr(branchName, prTitle) {
  const pr = await findPr(branchName, prTitle, 'closed');
  if (pr) {
    return true;
  }
  return false;
}

async function createPr(branchName, title, body, useDefaultBranch) {
  const targetBranch = useDefaultBranch
    ? config.defaultBranch
    : config.baseBranch;
  logger.debug(`Creating Merge Request: ${title}`);
  const description = body
    .replace(/Pull Request/g, 'Merge Request')
    .replace(/PR/g, 'MR');
  const res = await glGot.post(`projects/${config.repoName}/merge_requests`, {
    body: {
      source_branch: branchName,
      target_branch: targetBranch,
      remove_source_branch: true,
      title,
      description,
    },
  });
  const pr = res.body;
  pr.number = pr.id;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  return pr;
}

async function getPr(prNo) {
  logger.debug(`getPr(${prNo})`);
  const url = `projects/${config.repoName}/merge_requests/${prNo}`;
  const pr = (await glGot(url)).body;
  // Harmonize fields with GitHub
  pr.number = config.apiVersion === 'v3' ? pr.id : pr.iid;
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
  const branch = await getBranch(pr.source_branch);
  if (branch && branch.commit.author_email === config.email) {
    pr.canRebase = true;
  }
  return pr;
}

async function updatePr(prNo, title, body) {
  const description = body
    .replace(/Pull Request/g, 'Merge Request')
    .replace(/PR/g, 'MR');
  await glGot.put(`projects/${config.repoName}/merge_requests/${prNo}`, {
    body: {
      title,
      description,
    },
  });
}

async function mergePr(pr) {
  await glGot.put(
    `projects/${config.repoName}/merge_requests/${pr.number}/merge`,
    {
      body: {
        should_remove_source_branch: true,
      },
    }
  );
}

// Generic File operations

async function getFile(filePath, branchName) {
  // Gitlab API v3 support
  let url;
  if (config.apiVersion === 'v3') {
    url = `projects/${config.repoName}/repository/files?file_path=${filePath}&ref=${branchName ||
      config.baseBranch}`;
  } else {
    url = `projects/${config.repoName}/repository/files/${filePath}?ref=${branchName ||
      config.baseBranch}`;
  }
  const res = await glGot(url);
  return res.body.content;
}

async function getFileContent(filePath, branchName) {
  try {
    const file = await getFile(filePath, branchName);
    return new Buffer(file, 'base64').toString();
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  }
}

async function getFileJson(filePath, branchName) {
  const fileContent = await getFileContent(filePath, branchName);
  return JSON.parse(fileContent);
}

async function createFile(branchName, filePath, fileContents, message) {
  // Gitlab API v3 support
  let url;
  const opts = {};
  if (config.apiVersion === 'v3') {
    url = `projects/${config.repoName}/repository/files`;
    opts.body = {
      file_path: filePath,
      branch_name: branchName,
      commit_message: message,
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    };
  } else {
    url = `projects/${config.repoName}/repository/files/${filePath}`;
    opts.body = {
      branch: branchName,
      commit_message: message,
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    };
  }
  await glGot.post(url, opts);
}

async function updateFile(branchName, filePath, fileContents, message) {
  // Gitlab API v3 support
  let url;
  const opts = {};
  if (config.apiVersion === 'v3') {
    url = `projects/${config.repoName}/repository/files`;
    opts.body = {
      file_path: filePath,
      branch_name: branchName,
      commit_message: message,
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    };
  } else {
    url = `projects/${config.repoName}/repository/files/${filePath}`;
    opts.body = {
      branch: branchName,
      commit_message: message,
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    };
  }
  await glGot.put(url, opts);
}

async function getSubDirectories(path) {
  logger.trace(`getSubDirectories(path=${path})`);
  const res = await glGot(
    `projects/${config.repoName}/repository/tree?path=${path}`
  );
  const directoryList = [];
  res.body.forEach(item => {
    if (item.type === 'tree') {
      directoryList.push(item.name);
    }
  });
  return directoryList;
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
      await createBranch(branchName);
    }
  }
  for (const file of files) {
    const existingFile = await getFileContent(file.name, branchName);
    if (existingFile) {
      logger.debug(`${file.name} exists - updating it`);
      await updateFile(branchName, file.name, file.contents, message);
    } else {
      logger.debug(`Creating file ${file.name}`);
      await createFile(branchName, file.name, file.contents, message);
    }
  }
}

// GET /projects/:id/repository/commits
async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    const res = await glGot(`projects/${config.repoName}/repository/commits`);
    return res.body.map(commit => commit.title);
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, ref = config.baseBranch) {
  // Gitlab API v3 support
  const opts = {};
  if (config.apiVersion === 'v3') {
    opts.body = {
      branch_name: branchName,
      ref,
    };
  } else {
    opts.body = {
      branch: branchName,
      ref,
    };
  }
  await glGot.post(`projects/${config.repoName}/repository/branches`, opts);
}
