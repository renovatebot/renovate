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
  // setBaseBranch,
  // // Search
  findFilePaths,                        //Done
  // // Branch
  branchExists,                         //Done (to test?)
  // getAllRenovateBranches,
  // isBranchStale,
  getBranchPr,
  // getBranchStatus,
  // getBranchStatusCheck,
  // setBranchStatus,
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
  // ensureCommentRemoval,
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
  const platformConfig = {};

  const repo = (await vstsHelper.gitApi().getRepositories(repoName))[0];
  //const repoDetail = await vstsHelper.gitApi().getRepository(repo.id);
  logger.debug({ repositoryDetails: repo }, 'Repository details');
  config.repoId = repo.id;
  platformConfig.privateRepo = true;
  platformConfig.isFork = false;
  config.owner = '?owner?';
  logger.debug(`${repoName} owner = ${config.owner}`);
  // Use default branch as PR target unless later overridden
  config.defaultBranch = repo.defaultBranch;
  config.baseBranch = config.defaultBranch;
  logger.debug(`${repoName} default branch = ${config.baseBranch}`);
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
  platformConfig.repoForceRebase = false;
  // try {
  //   const branchProtection = await getBranchProtection(config.baseBranch);
  //   if (branchProtection.strict) {
  //     logger.debug('Repo has branch protection and needs PRs up-to-date');
  //     platformConfig.repoForceRebase = true;
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
  return platformConfig;
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

async function getFile(filePath, branchName = config.baseBranch) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const item = await vstsHelper.gitApi()
    .getItemText(config.repoId, filePath, config.repoName, null, 0, false, false, true, {
      versionType: 0,
      version: vstsHelper.getBranchNameWithoutRefsheadsPrefix(branchName),
    });
  if (item && item.readable) {
    const buffer = item.read();
    const fileContent = Buffer.from(buffer, 'base64').toString();
    try {
      const jTmp = JSON.parse(fileContent);
      if (jTmp.typeKey === 'GitItemNotFoundException') {
        // file not found
        return null;
      } else if (jTmp.typeKey === 'GitUnresolvableToCommitException') {
        // branch not found
        return null;
      }
    } catch (error) {
      return null;
    }
    return fileContent
  }
  return null;
}

async function getFileContent(filePath, branchName) {
  logger.trace(
    `getFileContent(filePath=${filePath}, branchName=${branchName})`
  );
  return await getFile(filePath, branchName);
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

async function findFilePaths(fileName) {
  const items = await vstsHelper.gitApi()
    .getItems(
    config.repoId,
    config.repoName,
    null,
    'full',
    null,
    null,
    null,
    false
    );

  const filtered = items.filter(item => item.path.endsWith(fileName));
  const mapped = filtered.map(item => item.path);
  logger.debug(mapped);
  return mapped;
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
    const isBranchExisting = await branchExists(`heads/${branchName}`);
    if (isBranchExisting) {
      newBranch = vstsHelper.getVSTSBranchObj(
        branchName,
        (await vstsHelper.getRef(config.repoId, `refs/heads/${branchName}`))[0].objectId
      );
    }

    const commit = vstsHelper.getVSTSCommitObj(message, file.name, file.contents);
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
  const branchs = await vstsHelper.getRef(config.repoId, branchName);
  logger.debug(`Checking if branch exists: ${branchs}`);
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
      description: body,
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
    { title: title, description: body },
    config.repoId,
    prNo);
}