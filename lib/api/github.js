let logger = require('../logger');
const ghGotRetry = require('./gh-got-retry');

const config = {};

module.exports = {
  // GitHub App
  getInstallations,
  getInstallationToken,
  getInstallationRepositories,
  // Initialization
  getRepos,
  initRepo,
  setBaseBranch,
  // Search
  findFilePaths,
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
  addLabels,
  // PR
  findPr,
  checkForClosedPr,
  createPr,
  getPr,
  getAllPrs,
  updatePr,
  mergePr,
  // file
  getSubDirectories,
  commitFilesToBranch,
  getFile,
  getFileContent,
  getFileJson,
  // Commits
  getCommitMessages,
  getBranchCommit,
  getCommitDetails,
};

// Get all installations for a GitHub app
async function getInstallations(appToken) {
  logger.debug('getInstallations(appToken)');
  try {
    const url = 'app/installations';
    const options = {
      headers: {
        accept: 'application/vnd.github.machine-man-preview+json',
        authorization: `Bearer ${appToken}`,
      },
    };
    const res = await ghGotRetry(url, options);
    logger.debug(`Returning ${res.body.length} results`);
    return res.body;
  } catch (err) {
    logger.error({ err }, `GitHub getInstallations error`);
    throw err;
  }
}

// Get the user's installation token
async function getInstallationToken(appToken, installationId) {
  logger.debug(`getInstallationToken(appToken, ${installationId})`);
  try {
    const url = `installations/${installationId}/access_tokens`;
    const options = {
      headers: {
        accept: 'application/vnd.github.machine-man-preview+json',
        authorization: `Bearer ${appToken}`,
      },
    };
    const res = await ghGotRetry.post(url, options);
    return res.body.token;
  } catch (err) {
    logger.error({ err }, `GitHub getInstallationToken error`);
    throw err;
  }
}

// Get all repositories for a user's installation
async function getInstallationRepositories(userToken) {
  logger.debug('getInstallationRepositories(userToken)');
  try {
    const url = 'installation/repositories';
    const options = {
      headers: {
        accept: 'application/vnd.github.machine-man-preview+json',
        authorization: `token ${userToken}`,
      },
    };
    const res = await ghGotRetry(url, options);
    logger.debug(
      `Returning ${res.body.repositories.length} results from a total of ${res
        .body.total_count}`
    );
    return res.body;
  } catch (err) {
    logger.error({ err }, `GitHub getInstallationRepositories error`);
    throw err;
  }
}

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  logger.debug('getRepos(token, endpoint)');
  if (token) {
    process.env.GITHUB_TOKEN = token;
  } else if (!process.env.GITHUB_TOKEN) {
    throw new Error('No token found for getRepos');
  }
  if (endpoint) {
    process.env.GITHUB_ENDPOINT = endpoint;
  }
  try {
    const res = await ghGotRetry('user/repos');
    return res.body.map(repo => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `GitHub getRepos error`);
    throw err;
  }
}

// Initialize GitHub by getting base branch and SHA
async function initRepo(repoName, token, endpoint, repoLogger) {
  logger = repoLogger || logger;
  logger.debug(`initRepo("${repoName}")`);
  if (repoLogger) {
    logger = repoLogger;
  }
  if (token) {
    process.env.GITHUB_TOKEN = token;
  } else if (!process.env.GITHUB_TOKEN) {
    throw new Error(`No token found for GitHub repository ${repoName}`);
  }
  if (endpoint) {
    process.env.GITHUB_ENDPOINT = endpoint;
  }
  config.repoName = repoName;
  const platformConfig = {};
  try {
    const res = await ghGotRetry(`repos/${repoName}`, {
      headers: {
        accept: 'application/vnd.github.loki-preview+json',
      },
    });
    logger.trace({ repositoryDetails: res.body }, 'Repository details');
    platformConfig.privateRepo = res.body.private === true;
    platformConfig.isFork = res.body.fork === true;
    config.owner = res.body.owner.login;
    logger.debug(`${repoName} owner = ${config.owner}`);
    // Use default branch as PR target unless later overridden
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repoName} default branch = ${config.baseBranch}`);
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
    if (res.body.allow_rebase_merge) {
      config.mergeMethod = 'rebase';
    } else if (res.body.allow_squash_merge) {
      config.mergeMethod = 'squash';
    } else if (res.body.allow_merge_commit) {
      config.mergeMethod = 'merge';
    } else {
      logger.debug('Could not find allowed merge methods for repo');
    }
    platformConfig.repoForceRebase = false;
    try {
      const branchProtection = await getBranchProtection(config.baseBranch);
      if (branchProtection.strict) {
        logger.debug('Repo has branch protection and needs PRs up-to-date');
        platformConfig.repoForceRebase = true;
      } else {
        logger.debug(
          'Repo has branch protection but does not require up-to-date'
        );
      }
    } catch (err) {
      if (err.statusCode === 404) {
        logger.debug('Repo has no branch protection');
      } else if (err.statusCode === 403) {
        logger.debug('Do not have permissions to detect branch protection');
      } else {
        throw err;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 409) {
      logger.debug('Repository is not initiated');
      throw new Error('uninitiated');
    }
    logger.error({ err }, 'Unknown GitHub initRepo error');
    throw err;
  }
  return platformConfig;
}

async function getBranchProtection(branchName) {
  const res = await ghGotRetry(
    `repos/${config.repoName}/branches/${branchName}/protection/required_status_checks`,
    {
      headers: {
        accept: 'application/vnd.github.loki-preview+json',
      },
    }
  );
  return res.body;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  }
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName, content) {
  let results = [];
  let url = `search/code?q=`;
  if (content) {
    url += `${content}+`;
  }
  url += `repo:${config.repoName}+filename:${fileName}&per_page=100`;
  do {
    const res = await ghGotRetry(url);
    const exactMatches = res.body.items.filter(item => item.name === fileName);
    // GitHub seems to return files in the root with a leading `/`
    // which then breaks things later on down the line
    results = results.concat(
      exactMatches.map(item => item.path.replace(/^\//, ''))
    );
    const linkHeader = res.headers.link || '';
    const matches = linkHeader.match(
      /<https:\/\/api.github\.com\/(.*?)>; rel="next".*/
    );
    url = matches ? matches[1] : null;
  } while (url);
  return results;
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  try {
    const res = await ghGotRetry(
      `repos/${config.repoName}/git/refs/heads/${branchName}`
    );
    if (Array.isArray(res.body)) {
      // This seems to happen if GitHub has partial matches, so we check ref
      const matchedBranch = res.body.some(
        branch => branch.ref === `refs/heads/${branchName}`
      );
      if (matchedBranch) {
        logger.debug('Branch exists');
      } else {
        logger.debug('No matching branches');
      }
      return matchedBranch;
    }
    // This should happen if there's an exact match
    return res.body.ref === `refs/heads/${branchName}`;
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
  logger.trace('getAllRenovateBranches');
  const allBranches = (await ghGotRetry(
    `repos/${config.repoName}/git/refs/heads`
  )).body;
  return allBranches.reduce((arr, branch) => {
    if (branch.ref.indexOf(`refs/heads/${branchPrefix}`) === 0) {
      arr.push(branch.ref.substring('refs/heads/'.length));
    }
    return arr;
  }, []);
}

async function isBranchStale(branchName) {
  // Check if branch's parent SHA = master SHA
  logger.debug(`isBranchStale(${branchName})`);
  const branchCommit = await getBranchCommit(branchName);
  logger.debug(`branchCommit=${branchCommit}`);
  const commitDetails = await getCommitDetails(branchCommit);
  logger.debug({ commitDetails }, `commitDetails`);
  const parentSha = commitDetails.parents[0].sha;
  logger.debug(`parentSha=${parentSha}`);
  // Return true if the SHAs don't match
  return parentSha !== config.baseCommitSHA;
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const gotString =
    `repos/${config.repoName}/pulls?` +
    `state=open&base=${config.baseBranch}&head=${config.owner}:${branchName}`;
  const res = await ghGotRetry(gotString);
  if (!res.body.length) {
    return null;
  }
  const prNo = res.body[0].number;
  return getPr(prNo);
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
  const gotString = `repos/${config.repoName}/commits/${branchName}/status`;
  const res = await ghGotRetry(gotString);
  return res.body.state;
}

async function getBranchStatusCheck(branchName, context) {
  const branchCommit = await getBranchCommit(branchName);
  const url = `repos/${config.repoName}/commits/${branchCommit}/statuses`;
  const res = await ghGotRetry(url);
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
  const branchCommit = await getBranchCommit(branchName);
  const url = `repos/${config.repoName}/statuses/${branchCommit}`;
  const options = {
    state,
    description,
    context,
  };
  if (targetUrl) {
    options.target_url = targetUrl;
  }
  await ghGotRetry.post(url, { body: options });
}

async function deleteBranch(branchName) {
  await ghGotRetry.delete(
    `repos/${config.repoName}/git/refs/heads/${branchName}`
  );
}

async function mergeBranch(branchName, mergeType) {
  logger.debug(`mergeBranch(${branchName}, ${mergeType})`);
  if (mergeType === 'branch-push') {
    const url = `repos/${config.repoName}/git/refs/heads/${config.baseBranch}`;
    const options = {
      body: {
        sha: await getBranchCommit(branchName),
      },
    };
    try {
      await ghGotRetry.patch(url, options);
    } catch (err) {
      logger.error({ err }, `Error pushing branch merge for ${branchName}`);
      throw new Error('branch-push failed');
    }
  } else if (mergeType === 'branch-merge-commit') {
    const url = `repos/${config.repoName}/merges`;
    const options = {
      body: {
        base: config.baseBranch,
        head: branchName,
      },
    };
    try {
      await ghGotRetry.post(url, options);
    } catch (err) {
      logger.error({ err }, `Error pushing branch merge for ${branchName}`);
      throw new Error('branch-push failed');
    }
  } else {
    throw new Error(`Unsupported branch merge type: ${mergeType}`);
  }
  // Update base commit
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  // Delete branch
  await deleteBranch(branchName);
}

async function getBranchLastCommitTime(branchName) {
  try {
    const res = await ghGotRetry(
      `repos/${config.repoName}/commits?sha=${branchName}`
    );
    return new Date(res.body[0].commit.committer.date);
  } catch (err) {
    logger.error({ err }, `getBranchLastCommitTime error`);
    return new Date();
  }
}

// Issue

async function addAssignees(issueNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  await ghGotRetry.post(
    `repos/${config.repoName}/issues/${issueNo}/assignees`,
    {
      body: {
        assignees,
      },
    }
  );
}

async function addReviewers(issueNo, reviewers) {
  logger.debug(`Adding reviewers ${reviewers} to #${issueNo}`);
  await ghGotRetry.post(
    `repos/${config.repoName}/pulls/${issueNo}/requested_reviewers`,
    {
      body: {
        reviewers,
      },
    }
  );
}

async function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  await ghGotRetry.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
    body: labels,
  });
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${state})`);
  const urlString = `repos/${config.repoName}/pulls?head=${config.owner}:${branchName}&state=${state}`;
  logger.debug(`findPr urlString: ${urlString}`);
  const res = await ghGotRetry(urlString);
  let pr = null;
  res.body.forEach(result => {
    if (!prTitle || result.title === prTitle) {
      pr = result;
      if (pr.state === 'closed') {
        pr.isClosed = true;
      }
      pr.displayNumber = `Pull Request #${pr.number}`;
    }
  });
  return pr;
}

// Pull Request
async function checkForClosedPr(branchName, prTitle) {
  logger.debug(`checkForClosedPr(${branchName}, ${prTitle})`);
  const url = `repos/${config.repoName}/pulls?state=closed&head=${config.owner}:${branchName}`;
  const res = await ghGotRetry(url);
  // Return true if any of the titles match exactly
  return res.body.some(
    pr =>
      pr.title === prTitle && pr.head.label === `${config.owner}:${branchName}`
  );
}

// Creates PR and returns PR number
async function createPr(branchName, title, body, useDefaultBranch) {
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  const pr = (await ghGotRetry.post(`repos/${config.repoName}/pulls`, {
    body: {
      title,
      head: branchName,
      base,
      body,
    },
  })).body;
  pr.displayNumber = `Pull Request #${pr.number}`;
  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  if (!prNo) {
    return null;
  }
  const pr = (await ghGotRetry(`repos/${config.repoName}/pulls/${prNo}`)).body;
  if (!pr) {
    return null;
  }
  // Harmonise PR values
  pr.displayNumber = `Pull Request #${pr.number}`;
  if (pr.state === 'closed') {
    pr.isClosed = true;
  }
  if (!pr.isClosed) {
    if (pr.mergeable_state === 'dirty') {
      logger.debug(`PR mergeable state is dirty`);
      pr.isUnmergeable = true;
    }
    if (pr.commits === 1) {
      // Only one commit was made - must have been renovate
      logger.debug('Only 1 commit in PR so rebase is possible');
      pr.canRebase = true;
    } else {
      // Check if only one author of all commits
      logger.debug('Checking all commits');
      const prCommits = (await ghGotRetry(
        `repos/${config.repoName}/pulls/${prNo}/commits`
      )).body;
      const authors = prCommits.reduce((arr, commit) => {
        logger.trace({ commit }, `Checking commit`);
        let author = 'unknown';
        if (commit.author) {
          author = commit.author.login;
        } else if (commit.commit && commit.commit.author) {
          author = commit.commit.author.email;
        } else {
          logger.debug('Could not determine commit author');
        }
        logger.debug(`Commit author is: ${author}`);
        if (arr.indexOf(author) === -1) {
          arr.push(author);
        }
        return arr;
      }, []);
      logger.debug(`Author list: ${authors}`);
      if (authors.length === 1) {
        pr.canRebase = true;
      }
    }
    if (pr.base.sha !== config.baseCommitSHA) {
      pr.isStale = true;
    }
  }
  return pr;
}

async function getAllPrs() {
  const all = (await ghGotRetry(`repos/${config.repoName}/pulls?state=open`))
    .body;
  return all.map(pr => ({
    number: pr.number,
    branchName: pr.head.ref,
  }));
}

async function updatePr(prNo, title, body) {
  await ghGotRetry.patch(`repos/${config.repoName}/pulls/${prNo}`, {
    body: { title, body },
  });
}

async function mergePr(pr) {
  const url = `repos/${config.repoName}/pulls/${pr.number}/merge`;
  const options = {
    body: {},
  };
  if (config.mergeMethod) {
    // This path is taken if we have auto-detected the allowed merge types from the repo
    options.body.merge_method = config.mergeMethod;
    try {
      logger.debug({ options, url }, `mergePr`);
      await ghGotRetry.put(url, options);
    } catch (err) {
      logger.error({ err }, `Failed to ${options.body.merge_method} PR`);
      return false;
    }
  } else {
    // We need to guess the merge method and try squash -> rebase -> merge
    options.body.merge_method = 'rebase';
    try {
      logger.debug({ options, url }, `mergePr`);
      await ghGotRetry.put(url, options);
    } catch (err1) {
      logger.debug({ err: err1 }, `Failed to ${options.body.merge_method} PR`);
      try {
        options.body.merge_method = 'squash';
        logger.debug({ options, url }, `mergePr`);
        await ghGotRetry.put(url, options);
      } catch (err2) {
        logger.debug(
          { err: err2 },
          `Failed to ${options.body.merge_method} PR`
        );
        try {
          options.body.merge_method = 'merge';
          logger.debug({ options, url }, `mergePr`);
          await ghGotRetry.put(url, options);
        } catch (err3) {
          logger.debug(
            { err: err3 },
            `Failed to ${options.body.merge_method} PR`
          );
          logger.warn({ pr: pr.number }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  // Update base branch SHA
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  // Delete branch
  await deleteBranch(pr.head.ref);
  return true;
}

// Generic File operations

async function getFile(filePath, branchName) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const res = await ghGotRetry(
    `repos/${config.repoName}/contents/${filePath}?ref=${branchName ||
      config.baseBranch}`
  );
  return res.body.content;
}

async function getFileContent(filePath, branchName) {
  logger.trace(
    `getFileContent(filePath=${filePath}, branchName=${branchName})`
  );
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
  logger.trace(`getFileJson(filePath=${filePath}, branchName=${branchName})`);
  let fileJson = null;
  try {
    fileJson = JSON.parse(await getFileContent(filePath, branchName));
  } catch (err) {
    logger.error({ err }, `Failed to parse JSON for ${filePath}`);
  }
  return fileJson;
}

async function getSubDirectories(path) {
  logger.trace(`getSubDirectories(path=${path})`);
  const res = await ghGotRetry(`repos/${config.repoName}/contents/${path}`);
  const directoryList = [];
  res.body.forEach(item => {
    if (item.type === 'dir') {
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
  const parentCommit = await getBranchCommit(parentBranch);
  const parentTree = await getCommitTree(parentCommit);
  const fileBlobs = [];
  // Create blobs
  for (const file of files) {
    const blob = await createBlob(file.contents);
    fileBlobs.push({
      name: file.name,
      blob,
    });
  }
  // Create tree
  const tree = await createTree(parentTree, fileBlobs);
  const commit = await createCommit(parentCommit, tree, message);
  const isBranchExisting = await branchExists(branchName);
  if (isBranchExisting) {
    await updateBranch(branchName, commit);
  } else {
    await createBranch(branchName, commit);
  }
}

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, commit = config.baseCommitSHA) {
  await ghGotRetry.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: commit,
    },
  });
}

// Internal: Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  await ghGotRetry.patch(
    `repos/${config.repoName}/git/refs/heads/${branchName}`,
    {
      body: {
        sha: commit,
        force: true,
      },
    }
  );
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  logger.debug('Creating blob');
  return (await ghGotRetry.post(`repos/${config.repoName}/git/blobs`, {
    body: {
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    },
  })).body.sha;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  const res = await ghGotRetry(
    `repos/${config.repoName}/git/refs/heads/${branchName}`
  );
  return res.body.object.sha;
}

async function getCommitDetails(commit) {
  logger.debug(`getCommitDetails(${commit})`);
  const results = await ghGotRetry(
    `repos/${config.repoName}/git/commits/${commit}`
  );
  return results.body;
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  logger.debug(`getCommitTree(${commit})`);
  return (await ghGotRetry(`repos/${config.repoName}/git/commits/${commit}`))
    .body.tree.sha;
}

// Create a tree and return SHA
async function createTree(baseTree, files) {
  logger.debug(`createTree(${baseTree}, files)`);
  const body = {
    base_tree: baseTree,
    tree: [],
  };
  files.forEach(file => {
    body.tree.push({
      path: file.name,
      mode: '100644',
      type: 'blob',
      sha: file.blob,
    });
  });
  logger.trace({ body }, 'createTree body');
  return (await ghGotRetry.post(`repos/${config.repoName}/git/trees`, { body }))
    .body.sha;
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  return (await ghGotRetry.post(`repos/${config.repoName}/git/commits`, {
    body: {
      message,
      parents: [parent],
      tree,
    },
  })).body.sha;
}

async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    const res = await ghGotRetry(`repos/${config.repoName}/commits`);
    return res.body.map(commit => commit.commit.message);
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}
