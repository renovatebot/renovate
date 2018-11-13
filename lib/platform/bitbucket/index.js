const parseDiff = require('parse-diff');
const URL = require('url');
const api = require('./bb-got-wrapper');
const utils = require('./utils');
const hostRules = require('../../util/host-rules');
const GitStorage = require('../git/storage');

let config = {};

module.exports = {
  // Initialization
  getRepos,
  cleanRepo,
  initRepo,
  getRepoStatus: () => ({}),
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
  // Issue
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
  // Commits
  getCommitMessages,
  // vulnerability alerts
  getVulnerabilityAlerts,
};

const isCloud = false; // todo;

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
    if (isCloud) {
      const repos = await utils.accumulateValues(
        '/2.0/repositories/?role=contributor'
      );
      return repos.map(repo => repo.full_name);
    }
    const projects = await getProjects();
    const repos = await Promise.all(
      projects.map(
        async ({ key }) =>
          // TODO: can we filter this by permission=REPO_WRITE?
          await utils.accumulateValuesV2(`/rest/api/1.0/projects/${key}/repos`)
      )
    );
    return flatten(repos).map(r => `${r.project.key.toLowerCase()}/${r.name}`);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

function getProjects() {
  // BB Server only;
  return utils.accumulateValuesV2('/rest/api/1.0/projects');
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
  config = {};
  // TODO: get in touch with @rarkins about lifting up the caching into the app layer
  config.project = repository.split('/')[0];
  config.repository = repository.split('/')[1];

  if (gitFs) {
    const { host } = URL.parse(opts.endpoint);

    const url = GitStorage.getUrl({
      gitFs,
      auth: `${username}:${password}`,
      host: `${host}/scm`,
      repository,
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
      // (await api.get(`/1.0/repositories/${repository}`)).body
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
          `/rest/api/1.0/projects/${projectName}/repos/${repoName}/branches/default`
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
  // BB doesnt have an option to flag staled branches
  // TODO: Apparently new version has this, check out
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
async function getFileList(branchName) {
  const branch = branchName || config.baseBranch;
  config.fileList = config.fileList || {};
  if (config.fileList[branch]) {
    return config.fileList[branch];
  }
  try {
    const branchSha = await getBranchCommit(branch);
    let filesRaw;
    if (isCloud) {
      filesRaw = await utils.files(
        `/2.0/repositories/${config.repository}/src/${branchSha}/`
      );
    } else {
      filesRaw = await utils.accumulateValuesV2(
        `/rest/api/1.0/projects/${config.project}/repos/${
          config.repository
        }/files?at=${branchSha}`
      );
    }
    logger.debug({ filesRaw: filesRaw.length });
    // config.fileList[branch] = filesRaw.map(file => file.path);
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
    const branches = await utils.accumulateValuesV2(
      // `/2.0/repositories/${config.repository}/refs/branches/${branchName}`
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

  if (isCloud) {
    const allBranches = await utils.accumulateValues(
      `/2.0/repositories/${config.repository}/refs/branches`
    );
    return allBranches
      .map(branch => branch.name)
      .filter(name => name.startsWith(branchPrefix));
  }

  const allBranches = await utils.accumulateValuesV2(
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/branches/`
  );

  return allBranches
    .map(branch => branch.displayId)
    .filter(name => name.startsWith(branchPrefix));
}

// Check if branch's parent SHA = master SHA
async function isBranchStale(branchName) {
  logger.debug(`isBranchStale(${branchName})`);

  if (isCloud) {
    const [branch, baseBranch] = (await Promise.all([
      api.get(
        `/2.0/repositories/${config.repository}/refs/branches/${branchName}`
      ),
      api.get(
        `/2.0/repositories/${config.repository}/refs/branches/${
          config.baseBranch
        }`
      ),
    ])).map(res => res.body);

    const branchParentCommit = branch.target.parents[0].hash;
    const baseBranchLatestCommit = baseBranch.target.hash;
    return branchParentCommit !== baseBranchLatestCommit;
    // TODO: Disable lint suppression below when
    // TODO: refactoring and covering for both cloud and server implementations
    // eslint-disable-next-line no-else-return
  } else {
    // /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/branches
    // /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/commits/{commitId}

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
  const sha = await getBranchCommit(branchName);
  const statuses = await utils.accumulateValues(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses`
  );
  const noOfFailures = statuses.filter(status => status.state === 'FAILED')
    .length;
  logger.debug(
    { branch: branchName, sha, statuses },
    'branch status check result'
  );
  if (noOfFailures) {
    return 'failed';
  }
  return 'success';
}

async function getBranchStatusCheck(branchName, context) {
  const sha = await getBranchCommit(branchName);
  const statuses = await utils.accumulateValues(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses`
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
  const sha = await getBranchCommit(branchName);

  // TargetUrl can not be empty so default to bitbucket
  const url = targetUrl || 'http://bitbucket.org';

  const body = {
    name: context,
    state: utils.buildStates[state],
    key: context,
    description,
    url,
  };

  await api.post(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses/build`,
    { body }
  );
}

async function deleteBranch(branchName, closePr) {
  if (isCloud) {
    // Cloud closes PR automatically when branch is deleted
    return api.delete(
      `/2.0/repositories/${config.repository}/refs/branches/${branchName}`
    );
  }

  if (closePr) {
    logger.debug('declining PR');
    const pr = await platform.findPr(branchName, null, 'open', true);
    await api.post(
      `/rest/api/1.0/projects/${config.project}/repos/${
        config.repository
      }/pull-requests/${pr.number}/decline?version=${pr.version + 1}` // TODO: fix off-by-one
    );
  }
  return api.delete(
    // TODO: use gitFS
    `/rest/branch-utils/1.0/projects/${config.project}/repos/${
      config.repository
    }/branches`,
    { body: { name: branchName } }
  );
}

function mergeBranch() {
  // The api does not support merging branches, so any automerge must be done via PR
  // TODO: investigate support on Server
  return Promise.reject(new Error('Branch automerge not supported'));
}

async function findOpenIssues(title) {
  try {
    const currentUser = (await api.get('/2.0/user')).body.username;
    const filter = encodeURIComponent(
      [
        `title=${JSON.stringify(title)}`,
        '(state = "new" OR state = "open")',
        `reporter.username="${currentUser}"`,
      ].join(' AND ')
    );
    return (
      (await api.get(
        `/2.0/repositories/${config.repository}/issues?q=${filter}`
      )).body.values || []
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn('Error finding issues');
    return [];
  }
}

async function findIssue(title) {
  logger.debug(`findIssue(${title})`);
  const issues = await findOpenIssues(title);
  if (!issues.length) {
    return null;
  }
  const [issue] = issues;
  return {
    number: issue.id,
    body: issue.content && issue.content.raw,
  };
}

async function closeIssue(issueNumber) {
  await api.put(
    `/2.0/repositories/${config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

async function ensureIssue(title, body) {
  logger.debug(`ensureIssue()`);
  try {
    const issues = await findOpenIssues(title);
    if (issues.length) {
      // Close any duplicates
      for (const issue of issues.slice(1)) {
        await closeIssue(issue.id);
      }
      const [issue] = issues;
      if (String(issue.content.raw).trim() !== body.trim()) {
        logger.info('Issue updated');
        await api.put(
          `/2.0/repositories/${config.repository}/issues/${issue.id}`,
          {
            body: { content: { raw: body, markup: 'markdown' } },
          }
        );
        return 'updated';
      }
    } else {
      logger.info('Issue created');
      await api.post(`/2.0/repositories/${config.repository}/issues`, {
        body: {
          title,
          content: { raw: body, markup: 'markdown' },
        },
      });
      return 'created';
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Repository has no issue tracker.')) {
      logger.info(
        `Issues are disabled, so could not create issue: ${err.message}`
      );
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

async function ensureIssueClosing(title) {
  const issues = await findOpenIssues(title);
  for (const issue of issues) {
    await closeIssue(issue.id);
  }
}

async function getBranchLastCommitTime(branchName) {
  const branches = await utils.accumulateValues(
    `/2.0/repositories/${config.repository}/refs/branches`
  );
  const branch = branches.find(br => br.name === branchName) || {
    target: {},
  };
  return branch.target.date ? new Date(branch.target.date) : new Date();
}

function addAssignees() {
  // Bitbucket supports "participants" and "reviewers" so does not seem to have the concept of "assignee"
  logger.warn('Cannot add assignees');
  return Promise.resolve();
}

function addReviewers() {
  logger.warn('Cannot add reviewers');
  return Promise.resolve();
}

// istanbul ignore next
function deleteLabel() {
  throw new Error('deleteLabel not implemented');
}

function ensureComment() {
  // https://developer.atlassian.com/bitbucket/api/2/reference/search?q=pullrequest+comment
  logger.warn('Comment functionality not implemented yet');
  return Promise.resolve();
}

function ensureCommentRemoval() {
  // The api does not support removing comments
  return Promise.resolve();
}

const isRelevantPr = (branchName, prTitle, states) => p =>
  p.branchName === branchName &&
  (!prTitle || p.title === prTitle) &&
  states.includes(p.state);

async function findPr(
  branchName,
  prTitle,
  inputStates = utils.prStates.all,
  refreshCache
) {
  let states;
  // istanbul ignore if
  if (inputStates === '!open') {
    states = utils.prStates.notOpen;
  } else {
    states = inputStates;
  }
  logger.debug(`findPr(${branchName}, "${prTitle}", "${states}")`);
  const prList = await getPrList({ refreshCache });
  const pr = prList.find(isRelevantPr(branchName, prTitle, states));
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  } else {
    logger.debug(`DID NOT Found PR from branch #${branchName}`);
  }
  return pr;
}

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

  const isServer = true;

  const body = !isServer
    ? {
        title,
        description,
        source: {
          branch: {
            name: branchName,
          },
        },
        destination: {
          branch: {
            name: base,
          },
        },
        close_source_branch: true,
      }
    : {
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
    // `/2.0/repositories/${config.repository}/pullrequests`,
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

async function isPrConflicted(prNo) {
  const diff = (await api.get(
    // `/2.0/repositories/${config.repository}/pullrequests/${prNo}/diff`,
    `/rest/api/1.0/projects/${config.project}/repos/${
      config.repository
    }/pull-requests/${prNo}/diff`,
    { json: false }
  )).body;

  return utils.isConflicted(parseDiff(diff));
}

// Gets details for a PR
async function getPr(prNo) {
  const pr = (await api.get(
    // `/2.0/repositories/${config.repository}/pullrequests/${prNo}`
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
async function getPrFiles(prNo) {
  logger.debug({ prNo }, 'getPrFiles');
  const diff = (await api.get(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/diff`,
    { json: false }
  )).body;
  const files = parseDiff(diff).map(file => file.to);
  return files;
}

async function updatePr(prNo, title, description) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  if (isCloud) {
    await api.put(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}`,
      {
        body: { title, description },
      }
    );
  }

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

async function mergePr(prNo, branchName) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);

  try {
    await api.post(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}/merge`,
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
  } catch (err) /* istanbul ignore next */ {
    return false;
  }
  return true;
}

function getPrBody(input) {
  // Remove any HTML we use
  return input
    .replace(/<\/?summary>/g, '**')
    .replace(/<\/?details>/g, '')
    .substring(0, 50000);
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  try {
    const branches = await utils.accumulateValuesV2(
      // `/2.0/repositories/${config.repository}/refs/branches/${branchName}`
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
      // `/2.0/repositories/${config.repository}/src/${branchSha}/${filePath}`,
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

// TODO: Disable lint suppression below and address issue
// eslint-disable-next-line
async function getCommitMessages() {
  logger.debug('getCommitMessages');
  return config.storage.getCommitMessages();
}

// Pull Request

async function getPrList({
  state = utils.prStates.open,
  refreshCache = false,
} = {}) {
  logger.debug('getPrList()');
  if (!config.prList || refreshCache) {
    const prs = await utils.accumulateValuesV2(
      // `/2.0/repositories/${config.repository}/pullrequests?state=${state}`,
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

function cleanRepo() {
  api.reset();
  config = {};
}

function getVulnerabilityAlerts() {
  return [];
}
