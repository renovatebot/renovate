/* eslint-disable */
const logger = require('winston');
const glGot = require('gl-got');

const config = {};

module.exports = {
  initRepo,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  createBranch,
  getBranchPr,
  updateBranch,
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
  writeFile,
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

// Creates a new branch with provided commit
// If ref not present then defaults to default branch
async function createBranch(branchName, ref = config.defaultBranch) {
  let url = `projects/${config.repoName}/repository/branches`;
  url = `${url}?branch_name=${branchName}&ref=${ref}`
  await glGot.post(url);
}

// Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  console.trace(); throw new Error(`Not implemented`);
}

// Returns the Pull Request number for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=opened`;
  const res = await glGot(urlString);
  let pr = null;
  res.body.forEach((result) => {
    if (result.source_branch === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  // Harmonise to GitHub
  pr.number = pr.iid;
  if (pr.merge_status === 'cannot_be_merged') {
    pr.unmergeable = true;
  }
  return pr;
}

// Issue

async function addAssignees(issueNo, assignees) {
  console.trace(); throw new Error(`Not implemented`);
}

async function addReviewers(issueNo, reviewers) {
  console.trace(); throw new Error(`Not implemented`);
}

async function addLabels(issueNo, labels) {
  console.trace(); throw new Error(`Not implemented`);
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const urlString = `projects/${config.repoName}/merge_requests?state=${state}`;
  const res = await glGot(urlString);
  let pr = null;
  res.body.forEach((result) => {
    if (result.title === prTitle && result.source_branch === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  // GitHub uses number, GitLab uses iid
  pr.number = pr.iid;
  if (pr.state !== 'opened') {
    pr.closed = true;
  }
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
  console.trace(); throw new Error(`Not implemented`);
}

async function updatePr(prNo, title, body) {
  console.trace(); throw new Error(`Not implemented`);
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

async function writeFile(branchName, oldFileSHA, filePath, fileContents, message) {
  console.trace(); throw new Error(`Not implemented`);
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
  const existingFile = await getFileContent(fileName, branchName)
  if (existingFile) {
    logger.debug(`${fileName} exists - updating it`);
    await updateFile(branchName, fileName, fileContents, message);
  } else {
    logger.debug(`Creating file ${fileName}`);
    await createFile(branchName, fileName, fileContents, message);
  }
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  console.trace(); throw new Error(`Not implemented`);;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  console.trace(); throw new Error(`Not implemented`);
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  console.trace(); throw new Error(`Not implemented`);
}

// Create a tree and return SHA
async function createTree(baseTree, filePath, fileBlob) {
  console.trace(); throw new Error(`Not implemented`);
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  console.trace(); throw new Error(`Not implemented`);
}
