// @ts-nocheck //because of logger, we can't ts-check
const azureHelper = require('./azure-helper');
const azureApi = require('./azure-got-wrapper');
const hostRules = require('../../util/host-rules');
const { appSlug } = require('../../config/app-strings');

const config = {};

module.exports = {
  // Initialization
  getRepos,
  cleanRepo: () => undefined,
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

async function initRepo({ repository, token, endpoint }) {
  logger.debug(`initRepo("${repository}")`);
  const opts = hostRules.find({ platform: 'azure' }, { token, endpoint });
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
  config.privateRepo = true;
  config.isFork = false;
  config.owner = '?owner?';
  logger.debug(`${repository} owner = ${config.owner}`);
  // Use default branch as PR target unless later overridden
  config.defaultBranch = repo.defaultBranch;
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
  return config;
}

function getRepoForceRebase() {
  return false;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  }
}

async function getBranchCommit(fullBranchName) {
  const azureApiGit = await azureApi.gitApi();
  const commit = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(fullBranchName)
  );
  return commit.commit.commitId;
}

async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    // @ts-ignore
    const azureApiGit = await azureApi.gitApi();
    const res = await azureApiGit.getCommits(config.repoId);
    const msg = res.map(commit => commit.comment);
    return msg;
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}

async function getFile(filePath, branchName = config.baseBranch) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const f = await azureHelper.getFile(
    config.repoId,
    config.name,
    filePath,
    branchName
  );
  return f;
}

function getPrList() {
  return [];
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  let prsFiltered = [];
  try {
    const azureApiGit = await azureApi.gitApi();
    const prs = await azureApiGit.getPullRequests(config.repoId, null);

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

async function getFileList(branchName = config.baseBranch) {
  logger.trace(`getFileList('${branchName})'`);
  try {
    if (config.fileList) {
      return config.fileList;
    }
    const azureApiGit = await azureApi.gitApi();
    const items = await azureApiGit.getItems(
      config.repoId,
      null,
      null,
      120, // full
      null,
      null,
      null,
      false
    );
    config.fileList = items
      .filter(c => !c.isFolder)
      .map(c => c.path.substring(1, c.path.length))
      .sort();
    return config.fileList;
  } catch (error) {
    logger.error(`getFileList('${branchName})'`);
    return [];
  }
}

async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  logger.debug(
    `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
  );

  // Create the new Branch
  let branchRef = await azureHelper.getAzureBranchObj(
    config.repoId,
    branchName,
    parentBranch
  );

  const isBranchExisting = await branchExists(`refs/heads/${branchName}`);
  if (isBranchExisting) {
    branchRef = await azureHelper.getAzureBranchObj(
      config.repoId,
      branchName,
      branchName
    );
  }

  const changesInCommit = await azureHelper.getChanges(
    files,
    config.repoId,
    config.name,
    parentBranch
  );

  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.createPush(
    {
      commits: [
        {
          comment: message,
          changes: changesInCommit,
        },
      ],
      refUpdates: [branchRef],
    },
    config.repoId
  );
}

async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);

  const branchNameToUse = !branchName.startsWith('refs/heads/')
    ? `refs/heads/${branchName}`
    : branchName;

  const branchs = await azureHelper.getRefs(config.repoId, branchNameToUse);
  if (branchs.length === 0) {
    return false;
  }
  return true;
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
  const prs = await azureApiGit.getPullRequests(config.repoId, null);
  const azurePr = prs.filter(item => item.pullRequestId === pullRequestId);
  if (azurePr.length === 0) {
    return null;
  }
  logger.debug(`pr: (${azurePr[0]})`);
  const pr = azureHelper.getRenovatePRFormat(azurePr[0]);
  return pr;
}

async function createPr(branchName, title, body, labels, useDefaultBranch) {
  const sourceRefName = azureHelper.getNewBranchName(branchName);
  const targetRefName = useDefaultBranch
    ? config.defaultBranch
    : config.baseBranch;
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

async function isBranchStale(branchName) {
  logger.info(`isBranchStale(${branchName})`);
  // Check if branch's parent SHA = master SHA
  const branchCommit = await getBranchCommit(branchName);
  logger.debug(`branchCommit=${branchCommit}`);
  const commitDetails = await azureHelper.getCommitDetails(
    branchCommit,
    config.repoId
  );
  logger.debug({ commitDetails }, `commitDetails`);
  const parentSha = commitDetails.parents[0];
  logger.debug(`parentSha=${parentSha}`);
  logger.debug(`config.baseCommitSHA=${config.baseCommitSHA}`);
  // Return true if the SHAs don't match
  return parentSha !== config.baseCommitSHA;
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

async function getAllRenovateBranches(branchPrefix) {
  logger.debug(`getAllRenovateBranches(branchPrefix)(${branchPrefix})`);
  const azureApiGit = await azureApi.gitApi();
  const branches = await azureApiGit.getBranches(config.repoId);
  return branches.filter(c => c.name.startsWith(branchPrefix)).map(c => c.name);
}

async function deleteBranch(branchName, abandonAssociatedPr = false) {
  logger.debug(`deleteBranch(branchName)(${branchName})`);
  const ref = await azureHelper.getRefs(
    config.repoId,
    azureHelper.getNewBranchName(branchName)
  );
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.updateRefs(
    [
      {
        name: ref[0].name,
        oldObjectId: ref[0].objectId,
        newObjectId: '0000000000000000000000000000000000000000',
      },
    ],
    config.repoId
  );
  // istanbul ignore if
  if (abandonAssociatedPr) {
    const pr = await getBranchPr(branchName);
    await abandonPr(pr.number);
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

async function getBranchLastCommitTime(branchName) {
  logger.debug(`getBranchLastCommitTime(branchName)(${branchName})`);
  const azureApiGit = await azureApi.gitApi();
  const branch = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(branchName)
  );
  return branch.commit.committer.date;
}

function setBranchStatus(branchName, context, description, state, targetUrl) {
  logger.debug(
    `setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl}) - Not supported by Azure DevOps (yet!)`
  );
}

async function mergeBranch(branchName) {
  logger.info(
    `mergeBranch(branchName)(${branchName}) - Not supported by Azure DevOps (yet!)`
  );
  await null;
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

function findIssue() {
  // istanbul ignore next
  logger.warn(`findIssue() is not implemented`);
}

function ensureIssue() {
  // istanbul ignore next
  logger.warn(`ensureIssue() is not implemented`);
}

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
        await azureApiCore.getTeamMembers(repo.project.id, t.id)
    )
  );

  const ids = [];
  members.forEach(listMembers => {
    listMembers.forEach(m => {
      reviewers.forEach(r => {
        if (
          r.toLowerCase() === m.displayName.toLowerCase() ||
          r.toLowerCase() === m.uniqueName.toLowerCase()
        ) {
          if (ids.filter(c => c.id === m.id).length === 0) {
            ids.push({ id: m.id, name: r });
          }
        }
      });
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
function deleteLabel() {
  throw new Error('deleteLabel not implemented');
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
