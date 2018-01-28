const parseDiff = require('parse-diff');
const FormData = require('form-data');
const api = require('./bb-got');
const R = require('./nanoramda');
const utils = require('./utils');

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
  // Commits
  getCommitMessages,
};

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  logger.debug('getRepos(token, endpoint)');
  if (token) {
    process.env.BB_TOKEN = token;
  } else if (!process.env.BB_TOKEN) {
    throw new Error('No BB_TOKEN token found for getRepos');
  }
  if (endpoint) {
    process.env.BB_ENDPOINT = endpoint;
  }
  try {
    const repos = await utils.accumulateValues(
      `/2.0/repositories/?role=contributor`
    );
    return repos.map(R.prop('full_name'));
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

// Initialize bitbucket by getting base branch and SHA
async function initRepo(repoName, token, endpoint) {
  logger.debug(`initRepo("${repoName}")`);
  if (token) {
    process.env.BB_TOKEN = token;
  } else if (!process.env.BB_TOKEN) {
    throw new Error(`No token found for bitbucket repository ${repoName}`);
  }
  if (endpoint) {
    process.env.BB_ENDPOINT = endpoint;
  }
  config = {};
  // TODO: get in touch with @rarkins about lifting up the caching into the app layer
  config.repoName = repoName;
  const platformConfig = {};
  try {
    const info = utils.repoInfoTransformer(
      (await api.get(`/2.0/repositories/${repoName}`)).body
    );
    platformConfig.privateRepo = info.privateRepo;
    platformConfig.isFork = info.isFork;
    platformConfig.repoFullName = info.repoFullName;
    config.owner = info.owner;
    logger.debug(`${repoName} owner = ${config.owner}`);
    config.defaultBranch = info.mainbranch;
    config.baseBranch = config.defaultBranch;
    config.mergeMethod = info.mergeMethod;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown BitBucket initRepo error');
    throw err;
  }
  delete config.issueList;
  delete config.prList;
  delete config.fileList;
  await Promise.all([getPrList(), getFileList()]);
  return platformConfig;
}

// Returns true if repository has rule enforcing PRs are up-to-date with base branch before merging
function getRepoForceRebase() {
  // BB doesnt have an option to flag staled branches
  return false;
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
    const fileListRaw = await utils.files(
      `/2.0/repositories/${config.repoName}/src/${branchName}/`
    );

    config.fileList = fileListRaw.map(R.prop('path'));
  } catch (err) /* istanbul ignore next */ {
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
  try {
    const { name } = (await api.get(
      `/2.0/repositories/${config.repoName}/refs/branches/${branchName}`
    )).body;
    return name === branchName;
  } catch (err) {
    if (err.statusCode === 404) {
      return false;
    }
    throw err;
  }
}

// TODO rewrite mutating reduce to filter in other adapters
async function getAllRenovateBranches(branchPrefix) {
  logger.trace('getAllRenovateBranches');
  const allBranches = await utils.accumulateValues(
    `/2.0/repositories/${config.repoName}/refs/branches`
  );
  return allBranches.map(R.prop('name')).filter(R.startsWith(branchPrefix));
}

// Check if branch's parent SHA = master SHA
async function isBranchStale(branchName) {
  logger.debug(`isBranchStale(${branchName})`);
  const branches = await utils.accumulateValues(
    `/2.0/repositories/${config.repoName}/refs/branches`
  );
  const branch = branches.find(R.propEq('name', branchName)) || { target: {} };

  const commits = await utils.accumulateValues(branch.links.commits.href);
  const repoInfo =
    (await api.get(`/2.0/repositories/${config.repoName}`)).body || {};
  const mainbranch = (repoInfo.mainbranch || {}).name || 'master';
  const mainbranchCommits = await utils.accumulateValues(
    `/2.0/repositories/${config.repoName}/commits/${mainbranch}`
  );
  const latestMainBranchCommitHash = R.head(
    mainbranchCommits.map(R.prop('hash'))
  );
  const branchCommitHashes = commits.map(R.prop('hash'));

  // branch is not stale if latest commit in master exist in branch
  return !branchCommitHashes.includes(latestMainBranchCommitHash);
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, utils.prStates.open);
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
  const branches = await utils.accumulateValues(
    `/2.0/repositories/${config.repoName}/refs/branches`
  );
  const branch = branches.find(R.propEq('name', branchName));
  const statuses = await utils.accumulateValues(
    branch.target.links.statuses.href
  );
  const noOfFailures = statuses.filter(R.propEq('state', 'FAILED')).length;
  logger.debug({ branch, statuses }, 'branch status check result');
  if (noOfFailures) {
    return 'failed';
  }
  return 'success';
}

async function getBranchStatusCheck(branchName, context) {
  const branch = (await api.get(
    utils.addMaxLength(
      `/2.0/repositories/${config.repoName}/refs/branches/${branchName}`
    )
  )).body;
  const statuses = await utils.accumulateValues(
    branch.target.links.statuses.href
  );
  const bbState = (statuses.find(status => status.key === context) || {}).state;

  return (
    Object.keys(utils.buildStates).find(
      stateKey => utils.buildStates[stateKey] === bbState
    ) || null
  );
}

async function setBranchStatus(
  branchName,
  context,
  description,
  state,
  targetUrl
) {
  const branch = (await api.get(
    utils.addMaxLength(
      `/2.0/repositories/${config.repoName}/refs/branches/${branchName}`
    )
  )).body;
  let url = targetUrl;

  if (!targetUrl) {
    url = 'http://bitbucket.org'; // TargetUrl can not be empty so default to bitbucket
  }

  const body = {
    name: context,
    state: utils.buildStates[state],
    key: context,
    description,
    url,
  };

  await api.post(`${branch.target.links.statuses.href}/build`, { body });
}

function deleteBranch() {
    // The api does not support deleting branches
}

function mergeBranch() {
    // The api does not support merging branches
}

function ensureIssue() {
  // The bitbucket API supportd creating (POST) and removing (DELETE) issues
  // It does NOT support updating an issue
  // one solution to updating could be deleting then creating a new issue (using the old information)
  // but it is dangerous since the new issue will have a new id.
  //
  // bitbucket API gives new id to issues based on what the highest CURRENT id is
  // So if the newest issue gets deleted the next issue created will reuse that id.
}
function ensureIssueClosing() {
  // Same issue as ensureIssue(),
  // the api does support settting state on issue but not UPDATING
}

async function getBranchLastCommitTime(branchName) {
  try {
    const branches = await utils.accumulateValues(
      `/2.0/repositories/${config.repoName}/refs/branches`
    );
    const branch = branches.find(R.propEq('name', branchName)) || {
      target: {},
    };
    return branch.target.date ? new Date(branch.target.date) : new Date();
  } catch (err) {
    logger.error({ err }, `getBranchLastCommitTime error`);
    return new Date();
  }
}

function addAssignees() {
  // Same issue as ensureIssue(),
  // the api does support settting assigners when issue is created but not UPDATING
}

function addReviewers() {
    // The api does not support adding reviewers only Default reviewers
}

function ensureComment() {
    // The api does not support adding comments
}

function ensureCommentRemoval() {
    // The api does not support removing comments
}

const isRelevantPr = (branchName, prTitle, states) => p =>
  p.branchName === branchName &&
  (!prTitle || p.title === prTitle) &&
  states.includes(p.state);

async function findPr(branchName, prTitle, states = utils.prStates.all) {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${states})`);
  const prList = await getPrList();
  const pr = prList.find(isRelevantPr(branchName, prTitle, states));
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr;
}

// Creates PR and returns PR number
async function createPr(
  branchName,
  title,
  description,
  labels,
  useDefaultBranch = true,
  targetBranch
) {
  // labels is not supported in BitBucket: https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb

  const repoInfo = (await api.get(`/2.0/repositories/${config.repoName}`)).body;
  const defaultBranch = repoInfo.mainbranch.name;
  const targetBranchName = useDefaultBranch ? defaultBranch : targetBranch;

  logger.debug(
    { repoName: config.repoName, title, base: targetBranchName },
    'Creating PR'
  );

  const body = {
    title,
    description,
    source: {
      branch: {
        name: branchName,
      },
    },
    destination: {
      branch: {
        name: targetBranchName,
      },
    },
    close_source_branch: true,
  };

  const prInfo = (await api.post(
    `/2.0/repositories/${config.repoName}/pullrequests`,
    { body }
  )).body;
  return prInfo.id;
}

// Gets details for a PR
async function getPr(prNo) {
  if (!prNo) {
    return null;
  }
  const pr = (await api.get(
    `/2.0/repositories/${config.repoName}/pullrequests/${prNo}`
  )).body;

  if (!pr) {
    return null;
  }

  const res = {
    displayNumber: `Pull Request #${pr.id}`,
  };

  const commits = await utils.accumulateValues(pr.links.commits.href);

  if (utils.prStates.open.includes(pr.state)) {
    if (commits.length === 1) {
      res.canRebase = true;
    } else {
      const uniqAuthors = R.uniq(commits.map(R.path(['author', 'raw'])));
      if (uniqAuthors.length === 1) {
        res.canRebase = true;
      }
    }
  }

  res.isStale = await isBranchStale(config.repoName, pr.source.branch.name);

  return res;
}

// Return a list of all modified files in a PR
async function getPrFiles(prNo) {
  logger.debug({ prNo }, 'getPrFiles');
  if (!prNo) {
    return [];
  }
  const diff = (await api.get(
    `/2.0/repositories/${config.repoName}/pullrequests/${prNo}/diff`,
    { json: false }
  )).body;
  const files = parseDiff(diff).map(R.prop('to'));
  return files;
}

async function updatePr(prNo, title, description) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  await api.put(`/2.0/repositories/${config.repoName}/pullrequests/${prNo}`, {
    body: { title, description },
  });
}

async function mergePr(prNo, branchName) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);

  try {
    await api.post(
      `/2.0/repositories/${config.repoName}/pullrequests/${prNo}/merge`,
      {
        body: {
          close_source_branch: true,
          merge_strategy: 'merge_commit',
          message: 'auto merged',
        },
      }
    );
    delete config.baseCommitSHA;
    logger.info('Automerging succeeded');
  } catch (err) {
    return false;
  }
  return true;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  const branch = (await api.get(
    `/2.0/repositories/${config.repoName}/refs/branches/${branchName}`
  )).body;
  return branch.target.hash;
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
  const parentBranchCommit = await getBranchCommit(parentBranch);

  const form = new FormData();

  // The commit message. When omitted, Bitbucket uses a canned string.
  form.append('message', message);

  // The raw string to be used as the new commit's author. This string follows the format "Erik van Zijst evzijst@atlassian.com".
  // When omitted, Bitbucket uses the authenticated user's full/display name and primary email address. Commits cannot be created anonymously.
  if (gitAuthor) {
    form.append('author', gitAuthor);
  }

  // A comma-separated list of SHA1s of the commits that should be the parents of the newly created commit.
  // When omitted, the new commit will inherit from and become a child of the main branch's tip/HEAD commit.
  // When more than one SHA1 is provided, the first SHA1 identifies the commit from which the content will be inherited.
  // When more than 2 parents are provided on a Mercurial repo, a 400 is returned as Mercurial does not support "octopus merges".
  form.append('parents', parentBranchCommit);

  // The name of the branch that the new commit should be created on. When omitted, the commit will be created on top of the main branch and will become the main branch's new head.
  // When a branch name is provided that already exists in the repo, then the commit will be created on top of that branch. In this case, if a parent SHA1 was also provided, then it is asserted that the parent is the branch's tip/HEAD at the time the request is made. When this is not the case, a 409 is returned.
  // This API cannot be used to create new anonymous heads in Mercurial repositories.
  // When a new branch name is specified (that does not already exist in the repo), and no parent SHA1s are provided, then the new commit will inherit from the current main branch's tip/HEAD commit, but not advance the main branch. The new commit will be the new branch. When the request also specifies a parent SHA1, then the new commit and branch are created directly on top of the parent commit, regardless of the state of the main branch.
  // When a branch name is not specified, but a parent SHA1 is provided, then Bitbucket asserts that it represents the main branch's current HEAD/tip, or a 409 is returned.
  // When a branch name is not specified and the repo is empty, the new commit will become the repo's root commit and will be on the main branch.
  // When a branch name is specified and the repo is empty, the new commit will become the repo's root commit and also define the repo's main branch going forward.
  // This API cannot be used to create additional root commits in non-empty repos.
  // The branch field cannot be repeated.
  // As a side effect, this API can be used to create a new branch without modifying any files, by specifying a new branch name in this field, together with parents, but omitting the files fields, while not sending any files. This will create a new commit and branch with the same contents as the first parent. The diff of this commit against its first parent will be empty.
  form.append('branch', branchName);

  // Optional field that declares the files that the request is manipulating. When adding a new file to a repo, or when overwriting an existing file, the client can just upload the full contents of the file in a normal form field and the use of this files meta data field is redundant. However, when the files field contains a file path that does not have a corresponding, identically-named form field, then Bitbucket interprets that as the client wanting to replace the named file with the null set and the file is deleted instead.
  // Paths in the repo that are referenced in neither files nor an individual file field, remain unchanged and carry over from the parent to the new commit.
  // This API does not support renaming as an explicit feature. To rename a file, simply delete it and recreate it under the new name in the same commit.
  files.forEach(({ name, contents }) => {
    form.append(`/${name}`, contents);
  });

  await api.post(`/2.0/repositories/${config.repoName}/src`, {
    json: false,
    body: form,
  });
}

// Generic File operations
async function getFile(filePath, branchName) {
  logger.debug(`getFile(filePath=${filePath}, branchName=${branchName})`);
  if (!branchName || branchName === config.baseBranch) {
    if (!config.fileList.includes(filePath)) {
      return null;
    }
  }
  try {
    const file = (await api.get(
      `/2.0/repositories/${config.repoName}/src/${branchName}/${filePath}`,
      { json: false }
    )).body;
    return file;
  } catch (err) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    const values = await utils.accumulateValues(`/2.0/repositories/${config.repoName}/commits`);
    return values.map(R.prop('message'));
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}

// Pull Request

async function getPrList(state = utils.prStates.open) {
  logger.debug('getPrList()');
  if (!config.prList) {
    logger.debug('Retrieving PR list');
    const prs = await utils.accumulateValues(
      `/2.0/repositories/${config.repoName}/pullrequests?state=${state}`,
      undefined,
      undefined,
      50
    );
    config.prList = prs.map(utils.prInfo);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  }
  return config.prList;
}
