let logger = require('../../logger');
const get = require('./gh-got-wrapper');

const config = {};

module.exports = {
  // Initialization
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
  getSubDirectories,
  commitFilesToBranch,
  getFile,
  getFileContent,
  getFileJson,
  // Commits
  getCommitMessages,
};

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
    const res = await get('user/repos');
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
  config.fileList = null;
  config.prList = null;
  const platformConfig = {};
  let res;
  try {
    res = await get(`repos/${repoName}`, {
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
    logger.info({ err, res }, 'Unknown GitHub initRepo error');
    throw err;
  }
  return platformConfig;
}

async function getBranchProtection(branchName) {
  const res = await get(
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

// Get full file list
async function getFileList(branchName = config.baseBranch) {
  if (config.fileList) {
    return config.fileList;
  }
  try {
    const res = await get(
      `repos/${config.repoName}/git/trees/${branchName}?recursive=true`
    );
    if (res.body.truncated) {
      logger.warn(
        { repository: config.repoName },
        'repository tree is truncated'
      );
    }
    config.fileList = res.body.tree
      .filter(item => item.type === 'blob' && item.mode !== '120000')
      .map(item => item.path)
      .sort();
  } catch (err) {
    // TODO: change this from warn to info once we know exactly why it happens
    logger.info(
      { repository: config.repoName },
      'Error retrieving git tree - no files detected'
    );
    config.fileList = [];
  }

  return config.fileList;
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  try {
    const res = await get(
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
  const allBranches = (await get(`repos/${config.repoName}/git/refs/heads`))
    .body;
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
  const gotString = `repos/${config.repoName}/commits/${branchName}/status`;
  const res = await get(gotString);
  logger.debug(
    { state: res.body.stage, statuses: res.body.statuses },
    'branch status check result'
  );
  return res.body.state;
}

async function getBranchStatusCheck(branchName, context) {
  const branchCommit = await getBranchCommit(branchName);
  const url = `repos/${config.repoName}/commits/${branchCommit}/statuses`;
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
  await get.post(url, { body: options });
}

async function deleteBranch(branchName) {
  await get.delete(`repos/${config.repoName}/git/refs/heads/${branchName}`);
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
      await get.patch(url, options);
    } catch (err) {
      logger.warn({ err }, `Error pushing branch merge for ${branchName}`);
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
      await get.post(url, options);
    } catch (err) {
      logger.warn({ err }, `Error pushing branch merge for ${branchName}`);
      throw new Error('branch-merge-commit failed');
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
    const res = await get(`repos/${config.repoName}/commits?sha=${branchName}`);
    return new Date(res.body[0].commit.committer.date);
  } catch (err) {
    logger.error({ err }, `getBranchLastCommitTime error`);
    return new Date();
  }
}

// Issue

async function addAssignees(issueNo, assignees) {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  await get.post(`repos/${config.repoName}/issues/${issueNo}/assignees`, {
    body: {
      assignees,
    },
  });
}

async function addReviewers(issueNo, reviewers) {
  logger.debug(`Adding reviewers ${reviewers} to #${issueNo}`);
  const res = await get.post(
    `repos/${config.repoName}/pulls/${issueNo}/requested_reviewers`,
    {
      headers: {
        accept: 'application/vnd.github.thor-preview+json',
      },
      body: {
        reviewers,
        team_reviewers: [],
      },
    }
  );
  logger.debug({ body: res.body }, 'Added reviewers');
}

async function addLabels(issueNo, labels) {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  if (Array.isArray(labels) && labels.length) {
    await get.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
      body: labels,
    });
  }
}

async function getComments(issueNo) {
  // GET /repos/:owner/:repo/issues/:number/comments
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `repos/${config.repoName}/issues/${issueNo}/comments?per_page=100`;
  const comments = (await get(url, { paginate: true })).body;
  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(issueNo, body) {
  // POST /repos/:owner/:repo/issues/:number/comments
  await get.post(`repos/${config.repoName}/issues/${issueNo}/comments`, {
    body: { body },
  });
}

async function editComment(commentId, body) {
  // PATCH /repos/:owner/:repo/issues/comments/:id
  await get.patch(`repos/${config.repoName}/issues/comments/${commentId}`, {
    body: { body },
  });
}

async function deleteComment(commentId) {
  // DELETE /repos/:owner/:repo/issues/comments/:id
  await get.delete(`repos/${config.repoName}/issues/comments/${commentId}`);
}

async function ensureComment(issueNo, topic, content) {
  logger.debug(`Ensuring comment "${topic}" in #${issueNo}`);
  const body = `### ${topic}\n\n${content}`;
  const comments = await getComments(issueNo);
  let commentId;
  let commentNeedsUpdating;
  comments.forEach(comment => {
    if (comment.body.startsWith(`### ${topic}\n\n`)) {
      commentId = comment.id;
      commentNeedsUpdating = comment.body !== body;
    }
  });
  if (!commentId) {
    await addComment(issueNo, body);
    logger.info({ repository: config.repoName, issueNo }, 'Added comment');
  } else if (commentNeedsUpdating) {
    await editComment(commentId, body);
    logger.info({ repository: config.repoName, issueNo }, 'Updated comment');
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
    await deleteComment(commentId);
  }
}

// Pull Request

async function getPrList() {
  if (!config.prList) {
    const res = await get(
      `repos/${config.repoName}/pulls?per_page=100&state=all`,
      { paginate: true }
    );
    config.prList = res.body.map(pr => ({
      number: pr.number,
      branchName: pr.head.ref,
      title: pr.title,
      state: pr.state,
      closed_at: pr.closed_at,
    }));
  }
  return config.prList;
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.filter(
    p =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      (state === 'all' || p.state === state)
  )[0];
  return pr ? { ...pr, isClosed: pr.state === 'closed' } : undefined;
}

// Creates PR and returns PR number
async function createPr(branchName, title, body, labels, useDefaultBranch) {
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  const pr = (await get.post(`repos/${config.repoName}/pulls`, {
    body: {
      title,
      head: branchName,
      base,
      body,
    },
  })).body;
  pr.displayNumber = `Pull Request #${pr.number}`;
  await addLabels(pr.number, labels);
  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  if (!prNo) {
    return null;
  }
  const pr = (await get(`repos/${config.repoName}/pulls/${prNo}`)).body;
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
      const prCommits = (await get(
        `repos/${config.repoName}/pulls/${prNo}/commits`
      )).body;
      const authors = prCommits.reduce((arr, commit) => {
        logger.trace({ commit }, `Checking commit`);
        let author = 'unknown';
        if (commit.committer && commit.committer.login) {
          author = commit.committer.login;
        } else if (commit.author) {
          author = commit.author.login;
        } else if (commit.commit && commit.commit.author) {
          author = commit.commit.author.email;
        } else {
          logger.debug('Could not determine commit author');
        }
        logger.debug(`Commit author is: ${author}`);
        // Ignore GitHub "web-flow"
        if (author !== 'web-flow' && arr.indexOf(author) === -1) {
          arr.push(author);
        }
        return arr;
      }, []);
      logger.debug(`Author list: ${authors}`);
      if (authors.length === 1) {
        pr.canRebase = true;
      }
    }
    if (!pr.base || pr.base.sha !== config.baseCommitSHA) {
      pr.isStale = true;
    }
  }
  return pr;
}

async function updatePr(prNo, title, body) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const patchBody = { title };
  if (body) {
    patchBody.body = body;
  }
  await get.patch(`repos/${config.repoName}/pulls/${prNo}`, {
    body: patchBody,
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
      await get.put(url, options);
    } catch (err) {
      logger.error({ err }, `Failed to ${options.body.merge_method} PR`);
      return false;
    }
  } else {
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
          logger.info({ pr: pr.number }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  logger.info('Automerging succeeded');
  // Update base branch SHA
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  // Delete branch
  await deleteBranch(pr.head.ref);
  return true;
}

// Generic File operations

async function getFile(filePath, branchName) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const res = await get(
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
    if (file) {
      return Buffer.from(file, 'base64').toString();
    }
    return null;
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
    logger.debug({ err }, `Failed to parse JSON for ${filePath}`);
  }
  return fileJson;
}

async function getSubDirectories(path) {
  logger.trace(`getSubDirectories(path=${path})`);
  const res = await get(`repos/${config.repoName}/contents/${path}`);
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
  await get.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha: commit,
    },
  });
}

// Internal: Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  await get.patch(`repos/${config.repoName}/git/refs/heads/${branchName}`, {
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
  return (await get.post(`repos/${config.repoName}/git/blobs`, {
    body: {
      encoding: 'base64',
      content: Buffer.from(fileContents).toString('base64'),
    },
  })).body.sha;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  const res = await get(
    `repos/${config.repoName}/git/refs/heads/${branchName}`
  );
  return res.body.object.sha;
}

async function getCommitDetails(commit) {
  logger.debug(`getCommitDetails(${commit})`);
  const results = await get(`repos/${config.repoName}/git/commits/${commit}`);
  return results.body;
}

// Return the tree SHA for a commit
async function getCommitTree(commit) {
  logger.debug(`getCommitTree(${commit})`);
  return (await get(`repos/${config.repoName}/git/commits/${commit}`)).body.tree
    .sha;
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
  return (await get.post(`repos/${config.repoName}/git/trees`, { body })).body
    .sha;
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  return (await get.post(`repos/${config.repoName}/git/commits`, {
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
    const res = await get(`repos/${config.repoName}/commits`);
    return res.body.map(commit => commit.commit.message);
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}
