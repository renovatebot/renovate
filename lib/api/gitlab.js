const logger = require('winston');
const glGot = require('gl-got');

const config = {};

module.exports = {
  getRepos,
  initRepo,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  getBranchPr,
  getBranchStatus,
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
  commitFilesToBranch,
  getFile,
  getFileContent,
  getFileJson,
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
    const res = await glGot('projects');
    return res.body.map(repo => repo.path_with_namespace);
  } catch (err) {
    logger.error(`GitLab getRepos error: ${JSON.stringify(err)}`);
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
  try {
    const res = await glGot(`projects/${config.repoName}`);
    config.defaultBranch = res.body.default_branch;
    logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
  } catch (err) {
    logger.error(`GitLab init error: ${JSON.stringify(err)}`);
    throw err;
  }
  return config;
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  logger.verbose("Can't find multiple package.json files in GitLab");
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
  return getPr(pr.id);
}

// Returns the combined status for a branch.
async function getBranchStatus(branchName) {
  logger.debug(`getBranchStatus(${branchName})`);
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
    if (status !== 'failed') {
      if (check.status === 'failed') {
        status = 'failed';
      } else if (check.status !== 'success') {
        status = check.status;
      }
    }
  });
  return status;
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

async function createPr(branchName, title, body) {
  logger.debug(`Creating Merge Request: ${title}`);
  const res = await glGot.post(`projects/${config.repoName}/merge_requests`, {
    body: {
      source_branch: branchName,
      target_branch: config.defaultBranch,
      remove_source_branch: true,
      title,
      description: body,
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
  pr.number = pr.id;
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
  // We can't rebase through GitLab API
  pr.canRebase = false;
  return pr;
}

async function updatePr(prNo, title, body) {
  await glGot.put(`projects/${config.repoName}/merge_requests/${prNo}`, {
    body: {
      title,
      description: body,
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

async function getFile(filePath, branchName = config.defaultBranch) {
  const res = await glGot(
    `projects/${config.repoName}/repository/files?file_path=${filePath}&ref=${branchName}`
  );
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
  await glGot.post(`projects/${config.repoName}/repository/files`, {
    body: {
      file_path: filePath,
      branch_name: branchName,
      commit_message: message,
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    },
  });
}

async function updateFile(branchName, filePath, fileContents, message) {
  await glGot.put(`projects/${config.repoName}/repository/files`, {
    body: {
      file_path: filePath,
      branch_name: branchName,
      commit_message: message,
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    },
  });
}

// Add a new commit, create branch if not existing
async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.defaultBranch
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

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, ref = config.defaultBranch) {
  await glGot.post(`projects/${config.repoName}/repository/branches`, {
    body: {
      branch_name: branchName,
      ref,
    },
  });
}
