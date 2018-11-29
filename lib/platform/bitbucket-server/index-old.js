const URL = require('url');
const is = require('@sindresorhus/is');
const addrs = require('email-addresses');

const hostRules = require('../../util/host-rules');
const GitStorage = require('../git/storage');

let config = {};

module.exports = {
  getRepos,
  cleanRepo,
  initRepo,
  getRepoStatus,
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
  findIssue,
  ensureIssue,
  ensureIssueClosing,
  addAssignees,
  addReviewers,
  deleteLabel,
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
  getPrBody,
  // file
  commitFilesToBranch,
  getFile,
  // commits
  getCommitMessages,
  // vulnerability alerts
  getVulnerabilityAlerts,
};

// Get all repositories that the user has READ access to
async function getRepos(token, endpoint) {
  const flatten = arrayOfArrays =>
    arrayOfArrays.reduce((prev, array) => prev.concat(array), []);

  logger.debug('getRepos(token, endpoint)');
  const opts = hostRules.find({ platform: 'bitbucket' }, { token, endpoint });
  // istanbul ignore next
  if (!opts.token) {
    throw new Error('No token found for getRepos');
  }
  hostRules.update({ ...opts, platform: 'bitbucket', default: true });
  try {
    const projects = await getProjects();
    const repos = await Promise.all(
      projects.map(({ key }) =>
        // TODO: can we filter this by permission=REPO_WRITE?
        utils.accumulateValuesV2(`/rest/api/1.0/projects/${key}/repos`)
      )
    );
    return flatten(repos).map(r => `${r.project.key.toLowerCase()}/${r.name}`);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

function cleanRepo() {
  if (config.storage) {
    config.storage.cleanRepo();
  }
  api.reset();
  config = {};
}

// Initialize bitbucket by getting base branch and SHA
async function initRepo({
  repository,
  token,
  endpoint,
  username,
  password,
  localDir,
}) {
  const gitFs = 'http'; // TODO
  logger.debug(`initRepo("${repository}")`);
  // logger.debug('LOCAL DIR', { localDir });
  const opts = hostRules.find({ platform: 'bitbucket' }, { token, endpoint });
  // istanbul ignore next
  if (!opts.token) {
    throw new Error(`No token found for Bitbucket repository ${repository}`);
  }
  hostRules.update({ ...opts, platform: 'bitbucket', default: true });
  api.reset();

  if (typeof repository !== 'string') {
    // shouldnt happen, keeping here during development
    throw new Error('repo is not a string');
  }
  const project = repository.split('/')[0];
  repository = repository.split('/')[1];

  // TODO: talk to @rarkins where to put this config
  config = { project, repository };

  if (gitFs) {
    const { host } = URL.parse(opts.endpoint);

    const url = GitStorage.getUrl({
      gitFs,
      auth: `${username}:${password}`,
      host: `${host}/scm`,
      repository: `${project}/${repository}`,
    });

    config.storage = new GitStorage();
    await config.storage.initRepo({
      ...config,
      localDir,
      url,
    });
  }

  const platformConfig = {};

  try {
    const info = utils.repoInfoTransformer(
      (await api.get(
        `/rest/api/1.0/projects/${config.project}/repos/${config.repository}`
      )).body
    );
    platformConfig.privateRepo = info.privateRepo;
    platformConfig.isFork = info.isFork;
    platformConfig.repoFullName = info.repoFullName;
    config.owner = info.owner;
    logger.debug(`${repository} owner = ${config.owner}`);
    config.defaultBranch = info.mainbranch
      ? info.mainbranch
      : (await api.get(
          `/rest/api/1.0/projects/${config.project}/repos/${
            config.repository
          }/branches/default`
        )).body.displayId;
    config.baseBranch = config.defaultBranch;
    config.mergeMethod = info.mergeMethod;
  } catch (err) /* istanbul ignore next */ {
    logger.debug(err);
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }
  delete config.prList;
  delete config.fileList;
  await Promise.all([getPrList(), getFileList()]);
  return platformConfig;
}

// Returns true if repository has rule enforcing PRs are up-to-date with base branch before merging
function getRepoForceRebase() {
  // TODO Server: what does this do? What does forceRebase have to do with stale branches &
  // branch protection (see github version)?
  // BB doesnt have an option to flag staled branches
  // TODO: Apparently new version has this, check out
  return false;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    await config.storage.setBaseBranch(branchName);
  }
}

// Search

// Get full file list
async function getFileList(branchName) {
  const branch = branchName || config.baseBranch;
  config.fileList = config.fileList || {};
  if (config.fileList[branch]) {
    return config.fileList[branch];
  }
  try {
    const branchSha = await getBranchCommit(branch);
    const filesRaw = await utils.accumulateValuesV2(
      `/rest/api/1.0/projects/${config.project}/repos/${
        config.repository
      }/files?at=${branchSha}`
    );
    logger.debug({ filesRaw: filesRaw.length });
    config.fileList[branch] = filesRaw;
  } catch (err) /* istanbul ignore next */ {
    logger.info(
      { repository: config.repository },
      'Error retrieving git tree - no files detected'
    );
    config.fileList[branch] = [];
  }
  return config.fileList[branch];
}

// Branch

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`branchExists(${branchName})`);
  try {
    const branches = await utils.accumulateValues(
      `/rest/api/1.0/projects/${config.project}/repos/${
        config.repository
      }/branches`
    );
    logger.debug({
      title: 'BRANCH EXISTS',
      branches: branches.map(x => x.displayId),
    });
    return branches.map(x => x.displayId).some(name => name === branchName);
  } catch (err) {
    if (err.statusCode === 404) {
      return false;
    }
    // istanbul ignore next
    throw err;
  }
}

// TODO rewrite mutating reduce to filter in other adapters
async function getAllRenovateBranches(branchPrefix) {
  logger.trace('getAllRenovateBranches');

  const allBranches = await utils.accumulateValuesV2(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/branches/`
  );

  return allBranches
    .map(branch => branch.displayId)
    .filter(name => name.startsWith(branchPrefix));
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.number) : null;
}

function getAllRenovateBranches(branchPrefix) {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

// Check if branch's parent SHA = master SHA
async function isBranchStale(branchName) {
  logger.debug(`isBranchStale(${branchName})`);

  const branches = await utils.accumulateValuesV2(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/branches`
  );
  const defaultBranch = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/branches/default`
  )).body;
  const prBranch = branches.find(x => x.displayId === branchName);

  const branchLatestCommit = prBranch.latestCommit;
  const branchParentCommit = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/commits/${branchLatestCommit}`
  )).body.parents[0].id;
  const baseBranchLatestCommit = defaultBranch.latestCommit;

  return branchParentCommit !== baseBranchLatestCommit;
}

async function isPrConflicted(prNo) {
  const diff = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prNo}/diff`,
    { json: false }
  )).body;

  return utils.isConflicted(parseDiff(diff));
}

// Add a new commit, create branch if not existing
// TODO: Disable lint suppression below and address issue
// eslint-disable-next-line
async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  logger.debug(
    `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
  );

  return config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
}

// Generic File operations
async function getFile(filePath, branchName) {
  logger.debug(`getFile(filePath=${filePath}, branchName=${branchName})`);
  if (!branchName || branchName === config.baseBranch) {
    const fileList = await getFileList(branchName);
    if (!fileList.includes(filePath)) {
      return null;
    }
  }
  try {
    const branchSha = await getBranchCommit(branchName || config.baseBranch);

    const file = (await api.get(
      `/rest/api/1.0/projects/${config.project}/repos/${
        config.repository
      }/raw/${filePath}?at=${branchSha}`,
      { json: false }
    )).body;
    logger.debug({ file });
    return file;
  } catch (err) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

function getFile(filePath, branchName) {
  return config.storage.getFile(filePath, branchName);
}

async function deleteBranch(branchName, closePr = false) {
  if (closePr) {
    throw new Error('needs implementation');
  }
  return config.storage.deleteBranch(branchName);
}

async function mergeBranch(branchName) {
  // The api does not support merging branches, so any automerge must be done via PR
  // TODO: investigate support on Server
  return Promise.reject(new Error('Branch automerge not supported'));
}

function getBranchLastCommitTime(branchName) {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
function getRepoStatus() {
  return config.storage.getRepoStatus();
}

// Returns the combined status for a branch.
async function getBranchStatus(branchName, requiredStatusChecks) {
  logger.debug(`getBranchStatus(${branchName})`);

  /**
   * 1. get list of Prs
   * 2. find pr for a branch
   * 3. check if /merge for pr
   */
  const prList = await getPrList();
  const prForBranch = prList.find(x => x.branchName === branchName);

  if (!prForBranch) {
    logger.info(`There is no open PR for branch: ${branchName}`);
    // do no harm
    return 'failed';
  }
  logger.debug({ prForBranch }, 'PRFORBRANCH');
  const isOkToMerge = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prForBranch.number}/merge`
  )).body.canMerge;

  return isOkToMerge ? 'success' : 'failed';
}

async function getBranchStatusCheck(branchName, context) {
  /**
   * 1. get list of Prs
   * 2. find pr for a branch
   * 3. check if /merge for pr
   */
  const prList = await getPrList();
  const prForBranch = prList.find(x => x.branchName === branchName);

  if (!prForBranch) {
    logger.info(`There is no open PR for branch: ${branchName}`);
    // do no harm
    return null;
  }
  logger.debug({ prForBranch }, 'PRFORBRANCH');
  const isOkToMerge = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prForBranch.number}/merge`
  )).body.canMerge;

  return isOkToMerge ? 'success' : 'failed';
}

async function setBranchStatus(
  branchName,
  context,
  description,
  state,
  targetUrl
) {
  logger.info('Bitbucket server doesnt support branch statuses');
  return;
}

// Issue

async function getIssueList() {
  // no concept of repo related issues, people just use Jira =(
  return [];
}

async function findIssue(title) {
  // not support
  return null;
}

async function ensureIssue(title, body) {
  // no concept of repo related issues, people just use Jira =(
  logger.info(`Bitbucket Server doesnt support issues`);
  return null;
}

async function ensureIssueClosing(title) {
  // no concept of repo related issues, people just use Jira =(
}

async function addAssignees(iid, assignees) {
  // no concept of repo related issues, people just use Jira =(
}

function addReviewers(iid, reviewers) {
  // no concept of repo related issues, people just use Jira =(
}

async function deleteLabel(issueNo, label) {
  // no concept of repo related issues, people just use Jira =(
}

async function ensureComment(issueNo, topic, content) {
  // no concept of repo related issues, people just use Jira =(
}

async function ensureCommentRemoval(issueNo, topic) {
  // no concept of repo related issues, people just use Jira =(
}

async function getPrList({
  state = utils.prStates.open,
  refreshCache = false,
} = {}) {
  logger.debug('getPrList()');
  if (!config.prList || refreshCache) {
    const prs = await utils.accumulateValuesV2(
      `/rest/api/1.0/projects/${config.project}/repos/${
        config.repository
      }/pull-requests?state=${state}`,
      undefined,
      undefined,
      50
    );
    config.prList = prs.map(utils.prInfo);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  } else {
    logger.debug('returning cached PR list');
  }
  return config.prList;
}
async function findPr(branchName, prTitle, state = 'all') {
  throw new Error('needs implementation');
}

// Pull Request

// Creates PR and returns PR number
async function createPr(
  branchName,
  title,
  description,
  labels,
  useDefaultBranch = true
) {
  // labels is not supported in Bitbucket: https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb

  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;

  logger.debug({ repository: config.repository, title, base }, 'Creating PR');

  const body = {
    title,
    description,
    fromRef: {
      id: `refs/heads/${branchName}`,
    },
    toRef: {
      id: `refs/heads/${base}`,
    },
  };

  const prInfo = (await api.post(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests`,
    { body }
  )).body;

  // debugger;

  const pr = { id: prInfo.id, displayNumber: `Pull Request #${prInfo.id}` };
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  const pr = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prNo}`
  )).body;

  // debugger;
  // istanbul ignore if
  if (!pr) {
    return null;
  }

  const res = {
    displayNumber: `Pull Request #${pr.id}`,
    ...utils.prInfo(pr),
  };

  if (utils.prStates.open.includes(pr.state)) {
    res.isConflicted = await isPrConflicted(prNo);
    // TODO investigate how to support BB server
    if (pr && pr.links && pr.links.commits && pr.links.commits.href) {
      const commits = await utils.accumulateValues(pr.links.commits.href);
      if (commits.length === 1) {
        res.canRebase = true;
      }
    } else {
      // BB server assumption for now
      res.canRebase = true;
    }
  }
  res.isStale = await isBranchStale(pr.fromRef.displayId);

  return res;
}

// Return a list of all modified files in a PR
async function getPrFiles(mrNo) {
  // TODO: Needs implementation
  // Used only by Renovate if you want it to validate user PRs that contain modifications of the Renovate config
  return [];
}

async function updatePr(prNo, title, description) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);

  const { version } = (await api.get(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prNo}`
  )).body;

  await api.put(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prNo}`,
    { body: { title, description, version } }
  );
}

async function mergePr(iid) {
  // TODO: Needs implementation
  // Used for "automerge" feature
  return false;
}

function getPrBody(input) {
  throw new Error('needs implementation');
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  try {
    const branches = await utils.accumulateValuesV2(
      `/rest/api/1.0/projects/${config.project}/repos/${
        config.repository
      }/branches`
    );
    logger.debug({ branches: branches.map(x => x.displayId) });
    // return branch.target.hash;
    return branches.find(x => x.displayId === branchName).latestCommit;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, `getBranchCommit('${branchName}') failed'`);
    return null;
  }
}

function getCommitMessages() {
  return config.storage.getCommitMessages();
}

function getVulnerabilityAlerts() {
  return [];
}
