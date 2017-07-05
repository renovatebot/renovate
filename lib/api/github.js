let logger = require('../logger');
const ghGot = require('gh-got');

const config = {};

module.exports = {
  // GitHub App
  getInstallations,
  getInstallationToken,
  getInstallationRepositories,
  // Initialization
  getRepos,
  initRepo,
  // Search
  findFilePaths,
  // Branch
  branchExists,
  getAllRenovateBranches,
  isBranchStale,
  getBranchPr,
  getBranchStatus,
  deleteBranch,
  mergeBranch,
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
  commitFilesToBranch,
  getFile,
  getFileContent,
  getFileJson,
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
    const res = await ghGot(url, options);
    logger.debug(`Returning ${res.body.length} results`);
    return res.body;
  } catch (err) {
    logger.error(`GitHub getInstallations error: ${JSON.stringify(err)}`);
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
    const res = await ghGot.post(url, options);
    return res.body.token;
  } catch (err) {
    logger.error(`GitHub getInstallationToken error: ${JSON.stringify(err)}`);
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
    const res = await ghGot(url, options);
    logger.debug(
      `Returning ${res.body.repositories.length} results from a total of ${res
        .body.total_count}`
    );
    return res.body;
  } catch (err) {
    logger.error(
      `GitHub getInstallationRepositories error: ${JSON.stringify(err)}`
    );
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
    const res = await ghGot('user/repos');
    return res.body.map(repo => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error(`GitHub getRepos error: ${JSON.stringify(err)}`);
    throw err;
  }
}

// Initialize GitHub by getting base branch and SHA
async function initRepo(repoName, token, endpoint, repoLogger) {
  logger = repoLogger || logger;
  logger.debug(`initRepo(${JSON.stringify(repoName)})`);
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
  try {
    const res = await ghGot(`repos/${repoName}`);
    config.owner = res.body.owner.login;
    logger.debug(`${repoName} owner = ${config.owner}`);
    config.defaultBranch = res.body.default_branch;
    if (res.body.allow_rebase_merge) {
      config.mergeMethod = 'rebase';
    } else if (res.body.allow_squash_merge) {
      config.mergeMethod = 'squash';
    } else if (res.body.allow_merge_commit) {
      config.mergeMethod = 'merge';
    } else {
      logger.debug('Could not find allowed merge methods for repo');
    }
    logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
    config.baseCommitSHA = await getBranchCommit(config.defaultBranch);
  } catch (err) /* istanbul ignore next */ {
    logger.error(`GitHub init error: ${JSON.stringify(err)}`);
    throw err;
  }
  return config;
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  const res = await ghGot(
    `search/code?q=repo:${config.repoName}+filename:${fileName}`
  );
  const exactMatches = res.body.items.filter(item => item.name === fileName);
  // GitHub seems to return files in the root with a leading `/`
  // which then breaks things later on down the line
  return exactMatches.map(item => item.path.replace(/^\//, ''));
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  try {
    const res = await ghGot(
      `repos/${config.repoName}/git/refs/heads/${branchName}`
    );
    if (res.statusCode === 200) {
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

async function getAllRenovateBranches() {
  logger.trace('getAllRenovateBranches');
  const allBranches = (await ghGot(`repos/${config.repoName}/git/refs/heads`))
    .body;
  return allBranches.reduce((arr, branch) => {
    if (branch.ref.indexOf('refs/heads/renovate/') === 0) {
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
  logger.debug(`commitDetails=${JSON.stringify(commitDetails)}`);
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
    `state=open&base=${config.defaultBranch}&head=${config.owner}:${branchName}`;
  const res = await ghGot(gotString);
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
    logger.warn(
      `Unsupported requiredStatusChecks: ${JSON.stringify(
        requiredStatusChecks
      )}`
    );
    return 'failed';
  }
  const gotString = `repos/${config.repoName}/commits/${branchName}/status`;
  logger.debug(gotString);
  const res = await ghGot(gotString);
  return res.body.state;
}

async function deleteBranch(branchName) {
  await ghGot.delete(`repos/${config.repoName}/git/refs/heads/${branchName}`);
}

async function mergeBranch(branchName, mergeType) {
  logger.debug(`mergeBranch(${branchName}, ${mergeType})`);
  if (mergeType === 'branch-push') {
    const url = `repos/${config.repoName}/git/refs/heads/${config.defaultBranch}`;
    const options = {
      body: {
        sha: await getBranchCommit(branchName),
      },
    };
    try {
      await ghGot.patch(url, options);
    } catch (err) {
      logger.error(`Error pushing branch merge for ${branchName}`);
      logger.debug(JSON.stringify(err));
      throw new Error('branch-push failed');
    }
  } else if (mergeType === 'branch-merge-commit') {
    const url = `repos/${config.repoName}/merges`;
    const options = {
      body: {
        base: config.defaultBranch,
        head: branchName,
      },
    };
    try {
      await ghGot.post(url, options);
    } catch (err) {
      logger.error(`Error pushing branch merge for ${branchName}`);
      logger.debug(JSON.stringify(err));
      throw new Error('branch-push failed');
    }
  } else {
    throw new Error(`Unsupported branch merge type: ${mergeType}`);
  }
  // Update base commit
  config.baseCommitSHA = await getBranchCommit(config.defaultBranch);
  // Delete branch
  await deleteBranch(branchName);
}

// Issue

async function addAssignees(issueNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  await ghGot.post(`repos/${config.repoName}/issues/${issueNo}/assignees`, {
    body: {
      assignees,
    },
  });
}

async function addReviewers(issueNo, reviewers) {
  logger.debug(`Adding reviewers ${reviewers} to #${issueNo}`);
  await ghGot.post(
    `repos/${config.repoName}/pulls/${issueNo}/requested_reviewers`,
    {
      headers: {
        accept: 'application/vnd.github.black-cat-preview+json',
      },
      body: {
        reviewers,
      },
    }
  );
}

async function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  await ghGot.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
    body: JSON.stringify(labels),
  });
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${state})`);
  const urlString = `repos/${config.repoName}/pulls?head=${config.owner}:${branchName}&state=${state}`;
  logger.debug(`findPr urlString: ${urlString}`);
  const res = await ghGot(urlString);
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
  const res = await ghGot(url);
  // Return true if any of the titles match exactly
  return res.body.some(
    pr =>
      pr.title === prTitle && pr.head.label === `${config.owner}:${branchName}`
  );
}

// Creates PR and returns PR number
async function createPr(branchName, title, body) {
  const pr = (await ghGot.post(`repos/${config.repoName}/pulls`, {
    body: { title, head: branchName, base: config.defaultBranch, body },
  })).body;
  pr.displayNumber = `Pull Request #${pr.number}`;
  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  if (!prNo) {
    return null;
  }
  const pr = (await ghGot(`repos/${config.repoName}/pulls/${prNo}`)).body;
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
      const prCommits = (await ghGot(
        `repos/${config.repoName}/pulls/${prNo}/commits`
      )).body;
      const authors = prCommits.reduce((arr, commit) => {
        logger.trace(`Checking commit: ${JSON.stringify(commit)}`);
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
  const all = (await ghGot(`repos/${config.repoName}/pulls?state=open`)).body;
  return all.map(pr => ({
    number: pr.number,
    branchName: pr.head.ref,
  }));
}

async function updatePr(prNo, title, body) {
  await ghGot.patch(`repos/${config.repoName}/pulls/${prNo}`, {
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
      logger.debug(`mergePr: ${url}, ${JSON.stringify(options)}`);
      await ghGot.put(url, options);
    } catch (err) {
      logger.error(
        `Failed to ${options.body.merge_method} PR: ${JSON.stringify(err)}`
      );
      return;
    }
  } else {
    // We need to guess the merge method and try squash -> rebase -> merge
    options.body.merge_method = 'rebase';
    try {
      logger.debug(`mergePr: ${url}, ${JSON.stringify(options)}`);
      await ghGot.put(url, options);
    } catch (err1) {
      logger.debug(
        `Failed to ${options.body.merge_method} PR: ${JSON.stringify(err1)}`
      );
      try {
        options.body.merge_method = 'squash';
        logger.debug(`mergePr: ${url}, ${JSON.stringify(options)}`);
        await ghGot.put(url, options);
      } catch (err2) {
        logger.debug(
          `Failed to ${options.body.merge_method} PR: ${JSON.stringify(err2)}`
        );
        try {
          options.body.merge_method = 'merge';
          logger.debug(`mergePr: ${url}, ${JSON.stringify(options)}`);
          await ghGot.put(url, options);
        } catch (err3) {
          logger.debug(
            `Failed to ${options.body.merge_method} PR: ${JSON.stringify(err3)}`
          );
          logger.error('All merge attempts failed');
          return;
        }
      }
    }
  }
  // Update base branch SHA
  config.baseCommitSHA = await getBranchCommit(config.defaultBranch);
  // Delete branch
  await deleteBranch(pr.head.ref);
}

// Generic File operations

async function getFile(filePath, branchName = config.defaultBranch) {
  const res = await ghGot(
    `repos/${config.repoName}/contents/${filePath}?ref=${branchName}`
  );
  return res.body.content;
}

async function getFileContent(filePath, branchName = config.defaultBranch) {
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

async function getFileJson(filePath, branchName = config.defaultBranch) {
  let fileJson = null;
  try {
    fileJson = JSON.parse(await getFileContent(filePath, branchName));
  } catch (err) {
    logger.error(`Failed to parse JSON for ${filePath}`);
  }
  return fileJson;
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
  await ghGot.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: commit,
    },
  });
}

// Internal: Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  await ghGot.patch(`repos/${config.repoName}/git/refs/heads/${branchName}`, {
    body: {
      sha: commit,
      force: true,
    },
  });
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  logger.debug('Creating blob');
  return (await ghGot.post(`repos/${config.repoName}/git/blobs`, {
    body: {
      encoding: 'base64',
      content: new Buffer(fileContents).toString('base64'),
    },
  })).body.sha;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  return (await ghGot(`repos/${config.repoName}/git/refs/heads/${branchName}`))
    .body.object.sha;
}

async function getCommitDetails(commit) {
  logger.debug(`getCommitDetails(${commit})`);
  const results = await ghGot(`repos/${config.repoName}/git/commits/${commit}`);
  return results.body;
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  logger.debug(`getCommitTree(${commit})`);
  return (await ghGot(`repos/${config.repoName}/git/commits/${commit}`)).body
    .tree.sha;
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
  logger.debug(body);
  return (await ghGot.post(`repos/${config.repoName}/git/trees`, { body })).body
    .sha;
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  return (await ghGot.post(`repos/${config.repoName}/git/commits`, {
    body: {
      message,
      parents: [parent],
      tree,
    },
  })).body.sha;
}
