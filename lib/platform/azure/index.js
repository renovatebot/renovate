// @ts-nocheck //because of logger, we can't ts-check
const azureHelper = require('./azure-helper');
const azureApi = require('./azure-got-wrapper');
const hostRules = require('../../util/host-rules');
const { appSlug } = require('../../config/app-strings');
const GitStorage = require('../git/storage').Storage;

let config = {};

const defaults = {
  hostType: 'azure',
};

module.exports = {
  // Initialization
  initPlatform,
  getRepos,
  cleanRepo,
  initRepo,
  getRepoStatus,
  getRepoForceRebase,
  setBaseBranch,
  setBranchPrefix,
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
  getIssueList,
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

function initPlatform({ endpoint, token }) {
  if (!endpoint) {
    throw new Error('Init: You must configure an Azure DevOps endpoint');
  }
  if (!token) {
    throw new Error('Init: You must configure an Azure DevOps token');
  }
  // TODO: Add a connection check that endpoint/token combination are valid
  const res = {
    endpoint: endpoint.replace(/\/?$/, '/'), // always add a trailing slash
  };
  defaults.endpoint = res.endpoint;
  azureApi.setEndpoint(res.endpoint);
  return res;
}

async function getRepos() {
  logger.info('Autodiscovering Azure DevOps repositories');
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  return repos.map(repo => `${repo.project.name}/${repo.name}`);
}

async function initRepo({ repository, localDir, azureWorkItemId }) {
  logger.debug(`initRepo("${repository}")`);
  config.repository = repository;
  config.fileList = null;
  config.prList = null;
  config.azureWorkItemId = azureWorkItemId;
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  const names = azureHelper.getProjectAndRepo(repository);
  const repo = repos.filter(
    c =>
      c.name.toLowerCase() === names.repo.toLowerCase() &&
      c.project.name.toLowerCase() === names.project.toLowerCase()
  )[0];
  logger.debug({ repositoryDetails: repo }, 'Repository details');
  config.repoId = repo.id;
  config.owner = '?owner?';
  logger.debug(`${repository} owner = ${config.owner}`);
  // Use default branch as PR target unless later overridden
  config.defaultBranch = repo.defaultBranch.replace('refs/heads/', '');
  config.baseBranch = config.defaultBranch;
  logger.debug(`${repository} default branch = ${config.defaultBranch}`);
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  config.mergeMethod = 'merge';
  config.repoForceRebase = false;
  config.storage = new GitStorage();
  const [projectName, repoName] = repository.split('/');
  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });
  const url =
    defaults.endpoint.replace('https://', `https://token:${opts.token}@`) +
    `${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}`;
  await config.storage.initRepo({
    ...config,
    localDir,
    url,
  });
  const platformConfig = {
    privateRepo: true,
    isFork: false,
  };
  return platformConfig;
}

function getRepoForceRebase() {
  return false;
}

// istanbul ignore next
async function setBaseBranch(branchName = config.baseBranch) {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  delete config.baseCommitSHA;
  delete config.fileList;
  await config.storage.setBaseBranch(branchName);
  await getFileList(branchName);
}

// istanbul ignore next
function setBranchPrefix(branchPrefix) {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

// istanbul ignore next
function getFileList(branchName) {
  return config.storage.getFileList(branchName);
}

// Branch

// istanbul ignore next
function branchExists(branchName) {
  return config.storage.branchExists(branchName);
}

// istanbul ignore next
function getAllRenovateBranches(branchPrefix) {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

// istanbul ignore next
function isBranchStale(branchName) {
  return config.storage.isBranchStale(branchName);
}

// istanbul ignore next
function getFile(filePath, branchName) {
  return config.storage.getFile(filePath, branchName);
}

// istanbul ignore next
async function deleteBranch(branchName, abandonAssociatedPr = false) {
  await config.storage.deleteBranch(branchName);
  // istanbul ignore if
  if (abandonAssociatedPr) {
    const pr = await getBranchPr(branchName);
    await abandonPr(pr.number);
  }
}

// istanbul ignore next
function getBranchLastCommitTime(branchName) {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
function getRepoStatus() {
  return config.storage.getRepoStatus();
}

// istanbul ignore next
function mergeBranch(branchName) {
  return config.storage.mergeBranch(branchName);
}

// istanbul ignore next
function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  return config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
}

// istanbul ignore next
function getCommitMessages() {
  return config.storage.getCommitMessages();
}

async function getBranchCommit(fullBranchName) {
  const azureApiGit = await azureApi.gitApi();
  const commit = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(fullBranchName)
  );
  return commit.commit.commitId;
}

function getPrList() {
  return [];
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  let prsFiltered = [];
  try {
    const azureApiGit = await azureApi.gitApi();
    const prs = await azureApiGit.getPullRequests(config.repoId, { status: 4 });

    prsFiltered = prs.filter(
      item => item.sourceRefName === azureHelper.getNewBranchName(branchName)
    );

    if (prTitle) {
      prsFiltered = prsFiltered.filter(item => item.title === prTitle);
    }

    // update format
    prsFiltered = prsFiltered.map(item =>
      azureHelper.getRenovatePRFormat(item)
    );

    switch (state) {
      case 'all':
        // no more filter needed, we can go further...
        break;
      case '!open':
        prsFiltered = prsFiltered.filter(item => item.state !== 'open');
        break;
      default:
        prsFiltered = prsFiltered.filter(item => item.state === state);
        break;
    }
  } catch (error) {
    logger.error('findPr ' + error);
  }
  if (prsFiltered.length === 0) {
    return null;
  }
  return prsFiltered[0];
}

async function getBranchPr(branchName) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.pullRequestId) : null;
}

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
  const branchStatusCheck = await getBranchStatusCheck(branchName);
  return branchStatusCheck;
}

async function getBranchStatusCheck(branchName, context) {
  logger.trace(`getBranchStatusCheck(${branchName}, ${context})`);
  const azureApiGit = await azureApi.gitApi();
  const branch = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(branchName)
  );
  if (branch.aheadCount === 0) {
    return 'success';
  }
  return 'pending';
}

async function getPr(pullRequestId) {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }
  const azureApiGit = await azureApi.gitApi();
  const prs = await azureApiGit.getPullRequests(config.repoId, { status: 4 });
  const azurePr = prs.filter(item => item.pullRequestId === pullRequestId);
  if (azurePr.length === 0) {
    return null;
  }
  const labels = await azureApiGit.getPullRequestLabels(
    config.repoId,
    pullRequestId
  );
  azurePr[0].labels = labels
    .filter(label => label.active)
    .map(label => label.name);
  logger.debug(`pr: (${azurePr[0]})`);
  const pr = azureHelper.getRenovatePRFormat(azurePr[0]);
  return pr;
}

async function createPr(
  branchName,
  title,
  body,
  labels,
  useDefaultBranch,
  platformOptions = {}
) {
  const sourceRefName = azureHelper.getNewBranchName(branchName);
  const targetRefName = azureHelper.getNewBranchName(
    useDefaultBranch ? config.defaultBranch : config.baseBranch
  );
  const description = azureHelper.max4000Chars(body);
  const azureApiGit = await azureApi.gitApi();
  const workItemRefs = [
    {
      id: config.azureWorkItemId,
    },
  ];
  let pr = await azureApiGit.createPullRequest(
    {
      sourceRefName,
      targetRefName,
      title,
      description,
      workItemRefs,
    },
    config.repoId
  );
  if (platformOptions.azureAutoComplete) {
    pr = await azureApiGit.updatePullRequest(
      {
        autoCompleteSetBy: {
          id: pr.createdBy.id,
        },
        completionOptions: {
          squashMerge: true,
          deleteSourceBranch: true,
        },
      },
      config.repoId,
      pr.pullRequestId
    );
  }
  await labels.forEach(async label => {
    await azureApiGit.createPullRequestLabel(
      {
        name: label,
      },
      config.repoId,
      pr.pullRequestId
    );
  });
  pr.branchName = branchName;
  return azureHelper.getRenovatePRFormat(pr);
}

async function updatePr(prNo, title, body) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const azureApiGit = await azureApi.gitApi();
  const objToUpdate = {
    title,
  };
  if (body) {
    objToUpdate.description = azureHelper.max4000Chars(body);
  }
  await azureApiGit.updatePullRequest(objToUpdate, config.repoId, prNo);
}

async function ensureComment(issueNo, topic, content) {
  logger.debug(`ensureComment(${issueNo}, ${topic}, content)`);
  const body = `### ${topic}\n\n${content}`;
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.createThread(
    {
      comments: [{ content: body, commentType: 1, parentCommentId: 0 }],
      status: 1,
    },
    config.repoId,
    issueNo
  );
}

async function ensureCommentRemoval(issueNo, topic) {
  logger.debug(`ensureCommentRemoval(issueNo, topic)(${issueNo}, ${topic})`);
  if (issueNo) {
    const azureApiGit = await azureApi.gitApi();
    const threads = await azureApiGit.getThreads(config.repoId, issueNo);
    let threadIdFound = null;

    threads.forEach(thread => {
      if (thread.comments[0].content.startsWith(`### ${topic}\n\n`)) {
        threadIdFound = thread.id;
      }
    });

    if (threadIdFound) {
      await azureApiGit.updateThread(
        {
          status: 4, // close
        },
        config.repoId,
        issueNo,
        threadIdFound
      );
    }
  }
}

// istanbul ignore next
async function abandonPr(prNo) {
  logger.debug(`abandonPr(prNo)(${prNo})`);
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.updatePullRequest(
    {
      status: 2,
    },
    config.repoId,
    prNo
  );
}

function setBranchStatus(branchName, context, description, state, targetUrl) {
  logger.debug(
    `setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl}) - Not supported by Azure DevOps (yet!)`
  );
}

async function mergePr(pr) {
  logger.info(`mergePr(pr)(${pr}) - Not supported by Azure DevOps (yet!)`);
  await null;
}

function getPrBody(input) {
  // Remove any HTML we use
  return input
    .replace(new RegExp(`\n---\n\n.*?<!-- ${appSlug}-rebase -->.*?\n`), '')
    .replace('<summary>', '**')
    .replace('</summary>', '**')
    .replace('<details>', '')
    .replace('</details>', '');
}

// istanbul ignore next
function findIssue() {
  logger.warn(`findIssue() is not implemented`);
}

// istanbul ignore next
function ensureIssue() {
  logger.warn(`ensureIssue() is not implemented`);
}

// istanbul ignore next
function ensureIssueClosing() {}

// istanbul ignore next
function getIssueList() {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  return [];
}

/**
 *
 * @param {number} issueNo
 * @param {string[]} assignees
 */
async function addAssignees(issueNo, assignees) {
  logger.trace(`addAssignees(${issueNo}, ${assignees})`);
  await ensureComment(
    issueNo,
    'Add Assignees',
    assignees.map(a => `@<${a}>`).join(', ')
  );
}

/**
 *
 * @param {number} prNo
 * @param {string[]} reviewers
 */
async function addReviewers(prNo, reviewers) {
  logger.trace(`addReviewers(${prNo}, ${reviewers})`);
  const azureApiGit = await azureApi.gitApi();
  const azureApiCore = await azureApi.getCoreApi();
  const repos = await azureApiGit.getRepositories();
  const repo = repos.filter(c => c.id === config.repoId)[0];
  const teams = await azureApiCore.getTeams(repo.project.id);
  const members = await Promise.all(
    teams.map(
      async t =>
        /* eslint-disable no-return-await */
        await azureApiCore.getTeamMembersWithExtendedProperties(
          repo.project.id,
          t.id
        )
    )
  );

  const ids = [];
  members.forEach(listMembers => {
    listMembers.forEach(m => {
      reviewers.forEach(r => {
        if (
          r.toLowerCase() === m.identity.displayName.toLowerCase() ||
          r.toLowerCase() === m.identity.uniqueName.toLowerCase()
        ) {
          if (ids.filter(c => c.id === m.identity.id).length === 0) {
            ids.push({ id: m.identity.id, name: r });
          }
        }
      });
    });
  });

  teams.forEach(t => {
    reviewers.forEach(r => {
      if (r.toLowerCase() === t.name.toLowerCase()) {
        if (ids.filter(c => c.id === t.id).length === 0) {
          ids.push({ id: t.id, name: r });
        }
      }
    });
  });

  await Promise.all(
    ids.map(async obj => {
      await azureApiGit.createPullRequestReviewer(
        {},
        config.repoId,
        prNo,
        obj.id
      );
      logger.info(`Reviewer added: ${obj.name}`);
    })
  );
}

// istanbul ignore next
async function deleteLabel(prNumber, label) {
  logger.debug(`Deleting label ${label} from #${prNumber}`);
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.deletePullRequestLabels(config.repoId, prNumber, label);
}

// to become async?
function getPrFiles(prNo) {
  logger.info(
    `getPrFiles(prNo)(${prNo}) - Not supported by Azure DevOps (yet!)`
  );
  return [];
}

function getVulnerabilityAlerts() {
  return [];
}

function cleanRepo() {
  // istanbul ignore if
  if (config.storage && config.storage.cleanRepo) {
    config.storage.cleanRepo();
  }
  config = {};
}
