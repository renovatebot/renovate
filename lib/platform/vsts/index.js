// @ts-nocheck //because of logger, we can't ts-check
const vstsHelper = require('./vsts-helper');
const gitApi = require('./vsts-got-wrapper');

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
  getPrFiles,
  updatePr,
  mergePr,
  // file
  commitFilesToBranch,
  getFile,
  // Commits
  getCommitMessages,
};

async function getRepos(token, endpoint) {
  logger.debug('getRepos(token, endpoint)');
  vstsHelper.setTokenAndEndpoint(token, endpoint);
  const repos = await gitApi().getRepositories();
  return repos.map(repo => repo.name);
}

async function initRepo(repoName, token, endpoint) {
  logger.debug(`initRepo("${repoName}")`);
  vstsHelper.setTokenAndEndpoint(token, endpoint);
  config.repoName = repoName;
  config.fileList = null;
  config.prList = null;

  const repo = (await gitApi().getRepositories(repoName))[0];
  // const repoDetail = await gitApi().getRepository(repo.id);
  logger.debug({ repositoryDetails: repo }, 'Repository details');
  config.repoId = repo.id;
  config.privateRepo = true;
  config.isFork = false;
  config.owner = '?owner?';
  logger.debug(`${repoName} owner = ${config.owner}`);
  // Use default branch as PR target unless later overridden
  config.defaultBranch = repo.defaultBranch;
  config.baseBranch = config.defaultBranch;
  logger.debug(`${repoName} default branch = ${config.defaultBranch}`);
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);

  // Todo VSTS: Get Merge method
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

  // Todo VSTS: Get getBranchProtection
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

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  }
}

async function getBranchCommit(fullBranchName) {
  const commit = await gitApi().getBranch(
    config.repoId,
    vstsHelper.getBranchNameWithoutRefsheadsPrefix(fullBranchName),
    config.repoName
  );
  return commit.commit.commitId;
}

async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    // @ts-ignore
    const res = await gitApi().getCommits(config.repoId);
    const msg = res.map(commit => commit.comment);
    return msg;
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}

async function getFile(filePath, branchName = config.baseBranch) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const f = await vstsHelper.getFile(
    config.repoId,
    config.name,
    filePath,
    branchName
  );
  return f;
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  let pr = null;
  try {
    const prs = await gitApi().getPullRequests(config.repoId, null);
    let prsFiltered = prs.filter(
      item => item.sourceRefName === vstsHelper.getNewBranchName(branchName)
    );
    if (prTitle) {
      prsFiltered = prsFiltered.filter(item => item.title === prTitle);
    }
    prsFiltered.forEach(item => {
      pr = vstsHelper.getRenovatePRFormat(item);
    });
  } catch (error) {
    logger.error('findPr ' + error);
  }
  return pr;
}

async function getFileList(branchName = config.baseBranch) {
  logger.trace(`getFileList('${branchName})'`);
  try {
    if (config.fileList) {
      return config.fileList;
    }
    const items = await gitApi().getItems(
      config.repoId,
      config.repoName,
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
  let newBranch = await vstsHelper.getVSTSBranchObj(
    branchName,
    (await vstsHelper.getRef(config.repoId, parentBranch))[0].objectId
  );

  // create commits
  for (const file of files) {
    const isBranchExisting = await branchExists(`refs/heads/${branchName}`);
    if (isBranchExisting) {
      newBranch = vstsHelper.getVSTSBranchObj(
        branchName,
        (await vstsHelper.getRef(config.repoId, `refs/heads/${branchName}`))[0]
          .objectId
      );
    }

    const commit = await vstsHelper.getVSTSCommitObj(
      message,
      file.name,
      file.contents,
      config.repoId,
      config.name,
      parentBranch
    );
    await gitApi().createPush(
      // @ts-ignore
      {
        commits: [commit],
        refUpdates: [newBranch],
      },
      config.repoId
    );
  }
}

async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);

  const branchNameToUse = !branchName.startsWith('refs/heads/')
    ? `refs/heads/${branchName}`
    : branchName;

  const branchs = await vstsHelper.getRef(config.repoId, branchNameToUse);
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
  const branch = await gitApi().getBranch(
    config.repoId,
    vstsHelper.getBranchNameWithoutRefsheadsPrefix(branchName),
    config.repoName
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
  const prs = await gitApi().getPullRequests(config.repoId, null);
  const vstsPr = prs.filter(item => item.pullRequestId === pullRequestId);
  if (vstsPr.length === 0) {
    return null;
  }
  logger.debug(`pr: (${vstsPr[0]})`);
  const pr = vstsHelper.getRenovatePRFormat(vstsPr[0]);
  return pr;
}

async function createPr(branchName, title, body, useDefaultBranch) {
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  const pr = await gitApi().createPullRequest(
    // @ts-ignore
    {
      sourceRefName: vstsHelper.getNewBranchName(branchName),
      targetRefName: base,
      title,
      description: vstsHelper.max4000Chars(body),
    },
    config.repoId
  );
  pr.displayNumber = `Pull Request #${pr.pullRequestId}`;
  return pr;
}

async function updatePr(prNo, title, body) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  await gitApi().updatePullRequest(
    // @ts-ignore
    { title, description: vstsHelper.max4000Chars(body) },
    config.repoId,
    prNo
  );
}

async function isBranchStale(branchName) {
  logger.info(`isBranchStale(branchName)(${branchName})`);
  // Check if branch's parent SHA = master SHA
  const branchCommit = await getBranchCommit(branchName);
  logger.debug(`branchCommit=${branchCommit}`);
  const commitDetails = await vstsHelper.getCommitDetails(
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
  await gitApi().createThread(
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
  const threads = await gitApi().getThreads(config.repoId, issueNo);
  let threadIdFound = null;

  threads.forEach(thread => {
    if (thread.comments[0].content.startsWith(`### ${topic}\n\n`)) {
      threadIdFound = thread.id;
    }
  });

  if (threadIdFound) {
    await gitApi().updateThread(
      {
        status: 4, // close
      },
      config.repoId,
      issueNo,
      threadIdFound
    );
  }
}

async function getAllRenovateBranches(branchPrefix) {
  logger.debug(`getAllRenovateBranches(branchPrefix)(${branchPrefix})`);
  const branches = await gitApi().getBranches(config.repoId);
  return branches.filter(c => c.name.startsWith(branchPrefix)).map(c => c.name);
}

async function deleteBranch(branchName) {
  logger.debug(`deleteBranch(branchName)(${branchName})`);
  const ref = await vstsHelper.getRef(
    config.repoId,
    vstsHelper.getNewBranchName(branchName)
  );
  return gitApi().updateRefs(
    [
      {
        name: ref[0].name,
        oldObjectId: ref[0].objectId,
        newObjectId: '0000000000000000000000000000000000000000',
      },
    ],
    config.repoId
  );
}

async function getBranchLastCommitTime(branchName) {
  logger.debug(`getBranchLastCommitTime(branchName)(${branchName})`);
  const branch = await gitApi().getBranch(
    config.repoId,
    vstsHelper.getBranchNameWithoutRefsheadsPrefix(branchName),
    config.repoName
  );
  return branch.commit.committer.date;
}

function setBranchStatus(branchName, context, description, state, targetUrl) {
  logger.debug(
    `setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${
      targetUrl
    }) - Not supported by VSTS (yet!)`
  );
}

async function mergeBranch(branchName, mergeType) {
  logger.info(
    `mergeBranch(branchName, mergeType)(${branchName}, ${
      mergeType
    }) - Not supported by VSTS (yet!)`
  );
  await null;
}

async function mergePr(pr) {
  logger.info(`mergePr(pr)(${pr}) - Not supported by VSTS (yet!)`);
  await null;
}

async function addAssignees(issueNo, assignees) {
  logger.info(
    `addAssignees(issueNo, assignees)(${issueNo}, ${
      assignees
    }) - Not supported by VSTS (yet!)`
  );
  await null;
}

async function addReviewers(issueNo, reviewers) {
  logger.info(
    `addReviewers(issueNo, reviewers)(${issueNo}, ${
      reviewers
    }) - Not supported by VSTS (yet!)`
  );
  await null;
}

async function getPrFiles(prNo) {
  logger.info(`getPrFiles(prNo)(${prNo}) - Not supported by VSTS (yet!)`);
  await [];
}
