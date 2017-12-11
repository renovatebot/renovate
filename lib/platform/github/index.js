const get = require('./gh-got-wrapper');
const addrs = require('email-addresses');
const moment = require('moment');
const openpgp = require('openpgp');
const path = require('path');

let config = {};

module.exports = {
  // Initialization
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
  addAssignees,
  addReviewers,
  // Comments
  ensureComment,
  ensureCommentRemoval,
  // PR
  findPr,
  createPr,
  getPr,
  getPrFiles,
  updatePr,
  mergePr,
  // file
  commitFilesToBranch,
  getFile,
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
    const res = await get('user/repos', { paginate: true });
    return res.body.map(repo => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `GitHub getRepos error`);
    throw err;
  }
}

// Initialize GitHub by getting base branch and SHA
async function initRepo(repoName, token, endpoint) {
  logger.debug(`initRepo("${repoName}")`);
  if (token) {
    process.env.GITHUB_TOKEN = token;
  } else if (!process.env.GITHUB_TOKEN) {
    throw new Error(`No token found for GitHub repository ${repoName}`);
  }
  if (endpoint) {
    process.env.GITHUB_ENDPOINT = endpoint;
  }
  config = {};
  get.reset();
  config.repoName = repoName;
  const platformConfig = {};
  let res;
  try {
    res = await get(`repos/${repoName}`);
    logger.trace({ repositoryDetails: res.body }, 'Repository details');
    platformConfig.privateRepo = res.body.private === true;
    platformConfig.isFork = res.body.fork === true;
    config.owner = res.body.owner.login;
    logger.debug(`${repoName} owner = ${config.owner}`);
    // Use default branch as PR target unless later overridden
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repoName} default branch = ${config.baseBranch}`);
    if (res.body.allow_rebase_merge) {
      config.mergeMethod = 'rebase';
    } else if (res.body.allow_squash_merge) {
      config.mergeMethod = 'squash';
    } else if (res.body.allow_merge_commit) {
      config.mergeMethod = 'merge';
    } else {
      logger.info('Could not find allowed merge methods for repo');
    }
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err, res }, 'Unknown GitHub initRepo error');
    throw err;
  }
  delete config.prList;
  delete config.fileList;
  await Promise.all([getPrList(), getFileList()]);
  return platformConfig;
}

async function getRepoForceRebase() {
  if (config.repoForceRebase === undefined) {
    try {
      config.repoForceRebase = false;
      const branchProtection = await getBranchProtection(config.baseBranch);
      logger.info('Found branch protection');
      if (branchProtection.required_pull_request_reviews) {
        logger.info(
          'Branch protection: PR Reviews are required before merging'
        );
        config.prReviewsRequired = true;
      }
      if (branchProtection.required_status_checks) {
        if (branchProtection.required_status_checks.strict) {
          logger.info(
            'Branch protection: PRs must be up-to-date before merging'
          );
          config.repoForceRebase = true;
        }
      }
      if (branchProtection.restrictions) {
        logger.info(
          {
            users: branchProtection.restrictions.users,
            teams: branchProtection.restrictions.teams,
          },
          'Branch protection: Pushing to branch is restricted'
        );
        config.pushProtection = true;
      }
    } catch (err) {
      if (err.statusCode === 404) {
        logger.info(`No branch protection found`);
      } else if (err.statusCode === 403) {
        logger.warn(
          'Branch protection: Do not have permissions to detect branch protection'
        );
      } else {
        throw err;
      }
    }
  }
  return config.repoForceRebase;
}

async function getBaseCommitSHA() {
  if (!config.baseCommitSHA) {
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  }
  return config.baseCommitSHA;
}

async function getBranchProtection(branchName) {
  const res = await get(
    `repos/${config.repoName}/branches/${branchName}/protection`
  );
  return res.body;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    delete config.baseCommitSHA;
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
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 409) {
      logger.debug('Repository is not initiated');
      throw new Error('uninitiated');
    }
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
  logger.debug(`branchExists(${branchName})`);
  const branchList = (await get(
    `repos/${config.repoName}/branches?per_page=100`,
    { paginate: true }
  )).body.map(branch => branch.name);
  return branchList.includes(branchName);
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
  logger.trace({ commitDetails }, `commitDetails`);
  const parentSha = commitDetails.parents[0].sha;
  logger.debug(`parentSha=${parentSha}`);
  const baseCommitSHA = await getBaseCommitSHA();
  logger.debug(`baseCommitSHA=${baseCommitSHA}`);
  // Return true if the SHAs don't match
  return parentSha !== baseCommitSHA;
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
  // istanbul ignore if
  if (config.pushProtection) {
    logger.info(
      { branchName, mergeType },
      'Branch protection: Attempting to merge branch when push protection is enabled'
    );
  }
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
  delete config.baseCommitSHA;
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
  const url = `repos/${
    config.repoName
  }/issues/${issueNo}/comments?per_page=100`;
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
  logger.debug('getPrList()');
  if (!config.prList) {
    logger.debug('Retrieving PR list');
    const res = await get(
      `repos/${config.repoName}/pulls?per_page=100&state=all`,
      { paginate: true }
    );
    config.prList = res.body.map(pr => ({
      number: pr.number,
      branchName: pr.head.ref,
      title: pr.title,
      state:
        pr.state === 'closed' && pr.merged_at && pr.merged_at.length
          ? 'merged'
          : pr.state,
      closed_at: pr.closed_at,
    }));
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
    logger.debug({ prList: config.prList });
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
  const pr = prList.find(
    p =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr;
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
  if (pr.state === 'open') {
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
        const message = commit.commit ? commit.commit.message : '';
        const parents = commit.parents || [];
        let ignoreWebFlow = false;
        if (
          author === 'web-flow' &&
          message.startsWith("Merge branch '") &&
          parents.length === 2
        ) {
          ignoreWebFlow = true;
        }
        // Ignore GitHub "web-flow"
        if (!ignoreWebFlow && arr.indexOf(author) === -1) {
          arr.push(author);
        }
        return arr;
      }, []);
      logger.debug(`Author list: ${authors}`);
      if (authors.length === 1) {
        pr.canRebase = true;
      }
    }
    const baseCommitSHA = await getBaseCommitSHA();
    if (!pr.base || pr.base.sha !== baseCommitSHA) {
      pr.isStale = true;
    }
  }
  return pr;
}

// Return a list of all modified files in a PR
async function getPrFiles(prNo) {
  logger.debug({ prNo }, 'getPrFiles');
  if (!prNo) {
    return [];
  }
  const files = (await get(`repos/${config.repoName}/pulls/${prNo}/files`))
    .body;
  return files.map(f => f.filename);
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

async function mergePr(prNo, branchName) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // istanbul ignore if
  if (config.pushProtection) {
    logger.info(
      { branchName, prNo },
      'Branch protection: Attempting to merge PR when push protection is enabled'
    );
  }
  // istanbul ignore if
  if (config.prReviewsRequired) {
    logger.info(
      { branchName, prNo },
      'Branch protection: Attempting to merge PR when PR reviews are enabled'
    );
  }
  const url = `repos/${config.repoName}/pulls/${prNo}/merge`;
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
      if (err.statusCode === 405) {
        // istanbul ignore next
        logger.info('GitHub blocking PR merge');
      } else {
        logger.warn({ err }, `Failed to ${options.body.merge_method} PR`);
      }
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
          logger.info({ pr: prNo }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  logger.info('Automerging succeeded');
  // Update base branch SHA
  delete config.baseCommitSHA;
  // Delete branch
  await deleteBranch(branchName);
  return true;
}

// Generic File operations

async function getFile(filePath, branchName) {
  logger.debug(`getFile(filePath=${filePath}, branchName=${branchName})`);
  if (!branchName || branchName === config.baseBranch) {
    if (!config.fileList.includes(filePath)) {
      return null;
    }
  }
  let res;
  try {
    res = await get(
      `repos/${config.repoName}/contents/${filePath}?ref=${branchName ||
        config.baseBranch}`
    );
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      logger.warn({ filePath, branchName }, 'getFile 404');
      return null;
    } else if (
      error.statusCode === 403 &&
      error.message &&
      error.message.startsWith('This API returns blobs up to 1 MB in size')
    ) {
      logger.info('Large file');
      let treeUrl = `repos/${config.repoName}/git/trees/${config.baseBranch}`;
      const parentPath = path.dirname(filePath);
      if (parentPath !== '.') {
        treeUrl += `.${parentPath}`;
      }
      const baseName = path.basename(filePath);
      let fileSha;
      (await get(treeUrl)).body.tree.forEach(file => {
        if (file.path === baseName) {
          fileSha = file.sha;
        }
      });
      if (!fileSha) {
        logger.warn('Could not locate file blob');
        throw error;
      }
      res = await get(`repos/${config.repoName}/git/blobs/${fileSha}`);
    } else {
      // Propagate if it's any other error
      throw error;
    }
  }
  if (res.body.content) {
    return Buffer.from(res.body.content, 'base64').toString();
  }
  return null;
}

// Add a new commit, create branch if not existing
async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch,
  gitAuthor,
  gitPrivateKey
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
  const commit = await createCommit(
    parentCommit,
    tree,
    message,
    gitAuthor,
    gitPrivateKey
  );
  const isBranchExisting = await branchExists(branchName);
  if (isBranchExisting) {
    await updateBranch(branchName, commit);
  } else {
    await createBranch(branchName, commit);
  }
}

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, sha) {
  await get.post(`repos/${config.repoName}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha,
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
async function createCommit(parent, tree, message, gitAuthor, gitPrivateKey) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message}, ${gitAuthor})`);
  const now = moment();
  let author;
  try {
    if (gitAuthor) {
      logger.debug({ gitAuthor }, 'Found gitAuthor');
      const { name, address: email } = addrs.parseOneAddress(gitAuthor);
      author = {
        name,
        email,
        date: now.format(),
      };
    }
  } catch (err) {
    logger.warn({ gitAuthor }, 'Error parsing gitAuthor');
  }
  const body = {
    message,
    parents: [parent],
    tree,
  };
  if (author) {
    body.author = author;
    // istanbul ignore if
    if (gitPrivateKey) {
      logger.debug('Found gitPrivateKey');
      const privKeyObj = openpgp.key.readArmored(gitPrivateKey).keys[0];
      const commit = `tree ${tree}\nparent ${parent}\nauthor ${author.name} <${
        author.email
      }> ${now.format('X ZZ')}\ncommitter ${author.name} <${
        author.email
      }> ${now.format('X ZZ')}\n\n${message}`;
      const { signature } = await openpgp.sign({
        data: openpgp.util.str2Uint8Array(commit),
        privateKeys: privKeyObj,
        detached: true,
        armor: true,
      });
      body.signature = signature;
    }
  }
  return (await get.post(`repos/${config.repoName}/git/commits`, { body })).body
    .sha;
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
