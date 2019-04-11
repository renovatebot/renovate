// @ts-nocheck //because of logger, we can't ts-check
const azureHelper = require('./azure-helper');
const azureApi = require('./azure-got-wrapper');
const hostRules = require('../../util/host-rules');
const { appSlug } = require('../../config/app-strings');
const GitStorage = require('../git/storage');

let config = {};

module.exports = {
  // Initialization
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
  // Commits
  getCommitMessages,
  // vulnerability alerts
  getVulnerabilityAlerts,
};

async function getRepos(token, endpoint) {
  logger.info('Autodiscovering Azure DevOps repositories');
  logger.debug('getRepos(token, endpoint)');
  const opts = hostRules.find({ platform: 'azure' }, { token, endpoint });
  hostRules.update({ ...opts, platform: 'azure', default: true });
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  return repos.map(repo => `${repo.project.name}/${repo.name}`);
}

async function initRepo({ repository, endpoint, localDir }) {
  logger.debug(`initRepo("${repository}")`);
  const opts = hostRules.find({ platform: 'azure' }, { endpoint });
  // istanbul ignore next
  if (!opts.token) {
    throw new Error('No token found for getRepos');
  }
  hostRules.update({ ...opts, platform: 'azure', default: true });
  config.repository = repository;
  config.fileList = null;
  config.prList = null;
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

  // Todo Azure: Get Merge method
  config.mergeMethod = 'merge';
  // if (res.body.allow_rebase_merge) {
  //   config.mergeMethod = 'rebase';
  // } else if (res.body.allow_squash_merge) {
  //   config.mergeMethod = 'squash';
  // } else if (res.body.allow_merge_commit) {
  //   config.mergeMethod = 'merge';
  // } else {
  //   logger.debug('Could not find allowed merge methods for repo');
  // }

  // Todo Azure: Get getBranchProtection
  config.repoForceRebase = false;
  // try {
  //   const branchProtection = await getBranchProtection(config.baseBranch);
  //   if (branchProtection.strict) {
  //     logger.debug('Repo has branch protection and needs PRs up-to-date');
  //     config.repoForceRebase = true;
  //   } else {
  //     logger.debug(
  //       'Repo has branch protection but does not require up-to-date'
  //     );
  //   }
  // } catch (err) {
  //   if (err.statusCode === 404) {
  //     logger.debug('Repo has no branch protection');
  //   } else if (err.statusCode === 403) {
  //     logger.debug('Do not have permissions to detect branch protection');
  //   } else {
  //     throw err;
  //   }
  // }
  // Always gitFs
  config.storage = new GitStorage();
  const [projectName, repoName] = repository.split('/');
  const url =
    endpoint.replace('https://', `https://token:${opts.token}@`) +
    `${projectName}/_git/${repoName}`;
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
async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    delete config.baseCommitSHA;
    delete config.fileList;
    await config.storage.setBaseBranch(branchName);
    await getFileList(branchName);
  }
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

async function createPr(branchName, title, body, labels, useDefaultBranch) {
  const sourceRefName = azureHelper.getNewBranchName(branchName);
  const targetRefName = azureHelper.getNewBranchName(
    useDefaultBranch ? config.defaultBranch : config.baseBranch
  );
  const description = azureHelper.max4000Chars(body);
  const azureApiGit = await azureApi.gitApi();
  const pr = await azureApiGit.createPullRequest(
    {
      sourceRefName,
      targetRefName,
      title,
      description,
    },
    config.repoId
  );
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
