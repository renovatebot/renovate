let logger = require('../logger');
const vstsHelper = require('./vsts-helper');

const config = {};

module.exports = {
  // vsts App
  // getInstallations,                  //Not supported
  // getInstallationToken,              //Not supported
  // getInstallationRepositories,       //Not supported
  // Initialization
  // getRepos,                          //Not supported
  initRepo,                             //Done
  setBaseBranch,                        //Done
  // // Search
  getFileList,                          //Done
  // // Branch
  branchExists,                         //Done 
  // getAllRenovateBranches,
  // isBranchStale,
  getBranchPr,
  getBranchStatus,                      //To be checked
  getBranchStatusCheck,                 //To be checked
  setBranchStatus,                      //To be checked
  // deleteBranch,
  // mergeBranch,
  // getBranchLastCommitTime,
  // // issue
  // addAssignees,
  // addReviewers,
  // addLabels,
  // // Comments
  // getComments,
  // addComment,
  // editComment,
  // deleteComment,
  // ensureComment,
  ensureCommentRemoval,               //Not supported by vsts
  // // PR
  // getPrList,
  findPr,                             //Done (check status...)
  createPr,
  // getPr,                           // to go private?
  updatePr,                           // Done
  // mergePr,
  // // file
  // getSubDirectories,
  commitFilesToBranch,
  // getFile,                         // to go private?
  getFileContent,                     //Done
  getFileJson,                        //Done
  // // Commits
  getCommitMessages,                  //Done
  getBranchCommit,                    //Done
  // getCommitDetails,
};

async function initRepo(repoName, token, endpoint, repoLogger) {
  logger = repoLogger || logger;
  logger.debug(`initRepo("${repoName}")`);
  if (repoLogger) {
    logger = repoLogger;
  }
  if (token) {
    process.env.VSTS_TOKEN = token;
  } else if (!process.env.VSTS_TOKEN) {
    throw new Error(`No token found for vsts repository ${repoName}`);
  }
  if (endpoint) {
    process.env.VSTS_ENDPOINT = endpoint;
  } else {
    throw new Error(
      `You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)`
    );
  }
  config.repoName = repoName;
  config.fileList = null;
  config.prList = null;

  const repo = (await vstsHelper.gitApi().getRepositories(repoName))[0];
  //const repoDetail = await vstsHelper.gitApi().getRepository(repo.id);
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
  const commit = await vstsHelper.gitApi()
    .getBranch(
    config.repoId,
    vstsHelper.getBranchNameWithoutRefsheadsPrefix(fullBranchName),
    config.repoName
    );
  return commit.commit.commitId;
}

async function getCommitMessages() {
  logger.debug('getCommitMessages');
  try {
    const res = await vstsHelper.gitApi().getCommits(config.repoId);
    const msg = res.map(commit => commit.comment);
    return msg
  } catch (err) {
    logger.error({ err }, `getCommitMessages error`);
    return [];
  }
}

async function getFileContent(filePath, branchName = config.baseBranch) {
  logger.trace(
    `getFileContent(filePath=${filePath}, branchName=${branchName})`
  );
  return await vstsHelper.getFile(config.repoId, config.name, filePath, branchName);
}

async function getFileJson(filePath, branchName) {
  logger.trace(`getFileJson(filePath=${filePath}, branchName=${branchName})`);
  let fileJson = null;
  try {
    fileJson = JSON.parse(await getFileContent(filePath, branchName));
  } catch (err) {
    logger.error({ err }, `Failed to parse JSON for ${filePath}`);
  }
  return fileJson;
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${state})`);
  const prs = await vstsHelper.gitApi().getPullRequests(config.repoId, null);
  let pr = null;
  let prsFiltered = prs.filter(item => item.sourceRefName === vstsHelper.getNewBranchName(branchName));
  if (prTitle) {
    prsFiltered = prsFiltered.filter(item => item.title === prTitle);
  }
  prsFiltered.forEach(item => {
    pr = item;
    if (pr.status === 2 || pr.status === 3) {
      pr.isClosed = true;
    }
    pr.displayNumber = `Pull Request #${pr.pullRequestId}`;
    pr.number = pr.pullRequestId;
  });
  return pr;
}

async function getFileList(branchName = config.baseBranch) {
  logger.trace(`getFileList('${branchName})'`);
  if (config.fileList) {
    return config.fileList;
  }
  const items = await vstsHelper.gitApi().getItems(config.repoId, config.repoName, null, 'full', null, null, null, false);
  config.fileList = items
    .filter(c => !c.isFolder)
    .map(c => c.path)
    .sort();
  return config.fileList;
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
        (await vstsHelper.getRef(config.repoId, `refs/heads/${branchName}`))[0].objectId
      );
    }

    const commit = await vstsHelper.getVSTSCommitObj(message, file.name, file.contents, config.repoId, config.name, parentBranch);
    await vstsHelper.gitApi().createPush(
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

  if (!branchName.startsWith("refs/heads/")) {
    branchName = `refs/heads/${branchName}`;
  }

  const branchs = await vstsHelper.getRef(config.repoId, branchName);
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
  return await getBranchStatusCheck(branchName)
  // const gotString = `repos/${config.repoName}/commits/${branchName}/status`;
  // const res = await get(gotString);
  // return res.body.state;
}

async function getBranchStatusCheck(branchName, context) {
  logger.trace(`getBranchStatusCheck(${branchName}, ${context})`)
  const branch = await vstsHelper.gitApi()
    .getBranch(
    config.repoId,
    vstsHelper.getBranchNameWithoutRefsheadsPrefix(branchName),
    config.repoName
    );
  if (branch.aheadCount === 0) {
    return 'success'
  }
  return 'pending';
}

async function setBranchStatus(branchName, context, description, state, targetUrl) {
  logger.debug('not implemented in vsts')
}

async function getPr(pullRequestId) {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }
  const prs = await vstsHelper.gitApi().getPullRequests(config.repoId, null);
  let pr = prs.filter(item => item.pullRequestId === pullRequestId)[0];
  logger.debug(`pr: (${pr})`);
  if (pr.status === 2 || pr.status === 3) {
    pr.isClosed = true;
  }
  pr.displayNumber = `Pull Request #${pr.pullRequestId}`;
  pr.number = pr.pullRequestId;
  if (!pr.isClosed) {
    // mergeStatus {
    //   NotSet = 0,
    //   Queued = 1,
    //   Conflicts = 2,
    //   Succeeded = 3,
    //   RejectedByPolicy = 4,
    //   Failure = 5,
    // }
    if (pr.mergeStatus === 2) {
      logger.debug(`PR mergeable state is dirty`);
      pr.isUnmergeable = true;
    }
  }
  return pr;
}

async function createPr(branchName, title, body, useDefaultBranch) {
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  const pr = await vstsHelper.gitApi().createPullRequest(
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
  const patchBody = { title };
  await vstsHelper.gitApi().updatePullRequest(
    { title: title, description: vstsHelper.max4000Chars(body) },
    config.repoId,
    prNo);
}

async function ensureCommentRemoval(issueNo, topic) {
  logger.debug(`Ensuring comment "${topic}" in #${issueNo} is removed => Not supported by VSTS`);
  // const comments = await getComments(issueNo);
  // let commentId;
  // comments.forEach(comment => {
  //   if (comment.body.startsWith(`### ${topic}\n\n`)) {
  //     commentId = comment.id;
  //   }
  // });
  // if (commentId) {
  //   await deleteComment(commentId);
  // }
}