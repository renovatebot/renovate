const logger = require('winston');
const glGot = require('gl-got');

const config = {};

module.exports = {
  initRepo,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  getBranchPr,
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
  // file
  commitFileToBranch,
  getFile,
  getFileContent,
  getFileJson,
};

// Initialize GitLab by getting base branch
async function initRepo(repoName, token) {
  logger.debug(`initRepo(${repoName})`);
  if (token) {
    process.env.GITLAB_TOKEN = token;
  } else if (!process.env.GITLAB_TOKEN) {
    throw new Error(`No token found for GitHub repository ${repoName}`);
  }
  config.repoName = repoName.replace('/', '%2F');
  try {
    const res = await glGot(`projects/${config.repoName}`);
    config.defaultBranch = res.body.default_branch;
    logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
  } catch (err) {
    logger.error(`GitHub init error: ${JSON.stringify(err)}`);
    throw err;
  }
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  logger.verbose('Can\'t find multiple package.json files in GitLab');
  return [fileName];
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
    logger.debug('Branch doesn\'t exist');
    return false;
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return false
      logger.debug('Branch doesn\'t exist');
      return false;
    }
    // Propagate if it's any other error
    throw error;
  }
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=opened`;
  const res = await glGot(urlString);
  logger.debug(`Got res with ${res.body.length} results`);
  let pr = null;
  res.body.forEach((result) => {
    if (result.source_branch === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  return getPr(pr.id);
}

// Issue

async function addAssignees(prNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${prNo}`);
  if (assignees.length > 1) {
    logger.error('Cannot assign more than one assignee to Merge Requests');
  }
  let url = `projects/${config.repoName}/merge_requests/prNo`;
  url = `${url}?assignee_id=${assignees[0]}`;
  await glGot.put(url);
}

async function addReviewers(prNo, reviewers) {
  logger.debug(`addReviewers('${prNo}, '${reviewers})`);
  logger.error('No reviewer functionality in GitLab');
}

async function addLabels(prNo, labels) {
  logger.debug(`Adding labels ${labels} to #${prNo}`);
  let url = `projects/${config.repoName}/merge_requests/prNo`;
  url = `${url}?labels=${labels.join(',')}`;
  await glGot.put(url);
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=${state}`;
  const res = await glGot(urlString);
  let pr = null;
  res.body.forEach((result) => {
    if ((!prTitle || result.title === prTitle) && result.source_branch === branchName) {
      pr = result;
      // GitHub uses number, GitLab uses iid
      pr.number = pr.id;
      pr.body = pr.description;
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

async function createPr(branchName, title, body) {
  logger.debug(`Creating Merge Request: ${title}`);
  let url = `projects/${config.repoName}/merge_requests`;
  url = `${url}?source_branch=${branchName}`;
  url = `${url}&target_branch=${config.defaultBranch}`;
  url = `${url}&title=${title}`;
  url = `${url}&description=${body}`;
  const res = await glGot.post(url);
  logger.silly(res.body);
  return res.body.iid;
}

async function getPr(prNo) {
  logger.debug(`getPr(${prNo})`);
  const url = `projects/${config.repoName}/merge_requests/${prNo}`;
  const pr = (await glGot(url)).body;
  // Harmonize fields with GitHub
  pr.number = pr.id;
  pr.body = pr.description;
  if (pr.state === 'closed' || pr.state === 'merged') {
    logger.debug('pr is closed');
    pr.isClosed = true;
  }
  if (pr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.isUnmergeable = true;
  }
  // We can't rebase through GitLab API
  pr.canRebase = false;
  return pr;
}

async function updatePr(prNo, title, body) {
  let url = `projects/${config.repoName}/merge_requests/${prNo}`;
  url = `${url}?title=${title}`;
  url = `${url}&description=${body}`;
  await glGot.put(url);
}

// Generic File operations

async function getFile(filePath, branchName = config.defaultBranch) {
  const res = await glGot(`projects/${config.repoName}/repository/files?file_path=${filePath}&ref=${branchName}`);
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
  try {
    const fileContent = await getFileContent(filePath, branchName);
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  }
}

async function createFile(branchName, filePath, fileContents, message) {
  let url = `projects/${config.repoName}/repository/files`;
  url = `${url}?file_path=${filePath}&branch_name=${branchName}&commit_message=${message}&encoding=base64`;
  url = `${url}&content=${new Buffer(fileContents).toString('base64')}`;
  logger.silly(url);
  await glGot.post(url);
}

async function updateFile(branchName, filePath, fileContents, message) {
  let url = `projects/${config.repoName}/repository/files`;
  url = `${url}?file_path=${filePath}&branch_name=${branchName}&commit_message=${message}&encoding=base64`;
  url = `${url}&content=${new Buffer(fileContents).toString('base64')}`;
  logger.silly(url);
  await glGot.put(url);
}

// Add a new commit, return SHA
async function commitFileToBranch(
  branchName,
  fileName,
  fileContents,
  message,
  parentBranch = config.defaultBranch) {
  logger.debug(`commitFileToBranch(${branchName}, ${fileName}, fileContents, message, ${parentBranch})`);
  if (branchName !== parentBranch) {
    const isBranchExisting = await branchExists(branchName);
    if (isBranchExisting) {
      logger.debug(`Branch ${branchName} already exists`);
    } else {
      logger.debug(`Creating branch ${branchName}`);
      await createBranch(branchName);
    }
  }
  const existingFile = await getFileContent(fileName, branchName);
  if (existingFile) {
    logger.debug(`${fileName} exists - updating it`);
    await updateFile(branchName, fileName, fileContents, message);
  } else {
    logger.debug(`Creating file ${fileName}`);
    await createFile(branchName, fileName, fileContents, message);
  }
}

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, ref = config.defaultBranch) {
  let url = `projects/${config.repoName}/repository/branches`;
  url = `${url}?branch_name=${branchName}&ref=${ref}`;
  await glGot.post(url);
}
