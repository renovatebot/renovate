let logger = require('../logger');
const vsts = require('vso-node-api');
const helper = require('./vstsHelper');

function vstsGotInit(token, endpoint) {
  if (token) {
    process.env.VSTS_TOKEN = token;
  } else if (!process.env.VSTS_TOKEN) {
    throw new Error(`No token found for vsts`);
  }
  if (endpoint) {
    process.env.VSTS_ENDPOINT = endpoint;
  } else {
    throw new Error(
      `You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)`
    );
  }
}

function vstsGot() {
  const authHandler = vsts.getPersonalAccessTokenHandler(
    process.env.VSTS_TOKEN
  );
  const connect = new vsts.WebApi(process.env.VSTS_ENDPOINT, authHandler);
  return connect;
}

const config = {};

module.exports = {
  // vsts App
  getInstallations,
  getInstallationToken,
  getInstallationRepositories,
  // Initialization
  getRepos,
  initRepo,
  setBaseBranch,
  // Search
  findFilePaths,
  // Branch
  getBranchProtection,
  branchExists,
  getAllRenovateBranches,
  isBranchStale,
  getBranchPr,
  getBranchStatus,
  deleteBranch,
  mergeBranch,
  createBranch,
  updateBranch,
  // issue
  addAssignees,
  addReviewers,
  addLabels,
  // PR
  findPr,
  checkForClosedPr,
  createPr,
  getPr,
  getAllPrs,
  updatePr,
  mergePr,
  // file
  getSubDirectories,
  commitFilesToBranch,
  getFile,
  getFileContent,
  getFileJson,
  // Commits
  getCommitMessages,
  // added
  createBlob,
  getCommitTree,
  createTree,
  createCommit,
};

// Get all installations for a vsts app
async function getInstallations(appToken) {
  throw new Error(`vsts error: getInstallations(${appToken})`);
  // logger.debug('getInstallations(appToken)');
  // try {
  //   const url = 'app/installations';
  //   const options = {
  //     headers: {
  //       accept: 'application/vnd.vsts.machine-man-preview+json',
  //       authorization: `Bearer ${appToken}`,
  //     },
  //   };
  //   const res = await ghGotRetry(url, options);
  //   logger.debug(`Returning ${res.body.length} results`);
  //   return res.body;
  // } catch (err) {
  //   logger.error({ err }, `vsts getInstallations error`);
  //   throw err;
  // }
}

// Get the user's installation token
async function getInstallationToken(appToken, installationId) {
  throw new Error(
    `vsts error: getInstallationToken(${appToken},${installationId})`
  );
  // logger.debug(`getInstallationToken(appToken, ${installationId})`);
  // try {
  //   const url = `installations/${installationId}/access_tokens`;
  //   const options = {
  //     headers: {
  //       accept: 'application/vnd.vsts.machine-man-preview+json',
  //       authorization: `Bearer ${appToken}`,
  //     },
  //   };
  //   const res = await ghGotRetry.post(url, options);
  //   return res.body.token;
  // } catch (err) {
  //   logger.error({ err }, `vsts getInstallationToken error`);
  //   throw err;
  // }
}

// Get all repositories for a user's installation
async function getInstallationRepositories(userToken) {
  throw new Error(`vsts error: getInstallationRepositories(${userToken})`);
  // logger.debug('getInstallationRepositories(userToken)');
  // try {
  //   const url = 'installation/repositories';
  //   const options = {
  //     headers: {
  //       accept: 'application/vnd.vsts.machine-man-preview+json',
  //       authorization: `token ${userToken}`,
  //     },
  //   };
  //   const res = await ghGotRetry(url, options);
  //   logger.debug(
  //     `Returning ${res.body.repositories.length} results from a total of ${res
  //       .body.total_count}`
  //   );
  //   return res.body;
  // } catch (err) {
  //   logger.error({ err }, `vsts getInstallationRepositories error`);
  //   throw err;
  // }
}

// Get all repositories that the user has access to
async function getRepos(token, endpoint) {
  throw new Error(`vsts error: getRepos(${token},${endpoint})`);
  // logger.debug('getRepos(token, endpoint)');
  // if (token) {
  //   process.env.VSTS_TOKEN = token;
  // } else if (!process.env.VSTS_TOKEN) {
  //   throw new Error('No token found for getRepos');
  // }
  // if (endpoint) {
  //   process.env.VSTS_ENDPOINT = endpoint;
  // }
  // try {
  //   const res = await ghGotRetry('user/repos');
  //   return res.body.map(repo => repo.full_name);
  // } catch (err) /* istanbul ignore next */ {
  //   logger.error({ err }, `vsts getRepos error`);
  //   throw err;
  // }
}

// Initialize vsts by getting base branch and SHA
async function initRepo(repoName, token, endpoint, repoLogger) {
  logger = repoLogger || logger;
  logger.debug(`initRepo("${repoName}")`);
  if (repoLogger) {
    logger = repoLogger;
  }
  config.repoName = repoName;
  const platformConfig = {};
  try {
    // const res = await ghGotRetry(`repos/${repoName}`);
    vstsGotInit(token, endpoint);
    const repos = await vstsGot().getGitApi().getRepositories(repoName);
    const repo = repos[0];
    logger.trace({ repositoryDetails: repo }, 'Repository details');
    config.repoId = repo.id;
    platformConfig.privateRepo = repo.project.visibility === 'private';
    platformConfig.isFork = false;
    config.owner = 'vstsOwner';
    logger.debug(`${repoName} owner = ${config.owner}`);
    // Use default branch as PR target unless later overridden
    config.defaultBranch = repo.defaultBranch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repoName} default branch = ${config.baseBranch}`);
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
    // if (res.body.allow_rebase_merge) {
    //   config.mergeMethod = 'rebase';
    // } else if (res.body.allow_squash_merge) {
    //   config.mergeMethod = 'squash';
    // } else if (res.body.allow_merge_commit) {
    //   config.mergeMethod = 'merge';
    // } else {
    //   logger.debug('Could not find allowed merge methods for repo');
    // }

    // Todo VSTS: Get Merge method
    config.mergeMethod = 'merge';

    // Todo VSTS: Get getBranchProtection
    platformConfig.repoForceRebase = true;

    //   platformConfig.repoForceRebase = false;
    //   try {
    //     const branchProtection = await getBranchProtection(config.baseBranch);
    //     if (branchProtection.strict) {
    //       logger.debug('Repo has branch protection and needs PRs up-to-date');
    //       platformConfig.repoForceRebase = true;
    //     } else {
    //       logger.debug(
    //         'Repo has branch protection but does not require up-to-date'
    //       );
    //     }
    //   } catch (err) {
    //     if (err.statusCode === 404) {
    //       logger.debug('Repo has no branch protection');
    //     } else if (err.statusCode === 403) {
    //       logger.debug('Do not have permissions to detect branch protection');
    //     } else {
    //       throw err;
    //     }
    //   }
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 409) {
      logger.debug('Repository is not initiated');
      throw new Error('uninitiated');
    }
    logger.error({ err }, 'Unknown vsts initRepo error');
    throw err;
  }
  return platformConfig;
}

async function getBranchProtection(branchName) {
  throw new Error(`vsts error: getBranchProtection(${branchName})`);
  // const res = await ghGotRetry(
  //   `repos/${config.repoName}/branches/${branchName}/protection/required_status_checks`,
  //   {
  //     headers: {
  //       accept: 'application/vnd.vsts.loki-preview+json',
  //     },
  //   }
  // );
  // return res.body;
}

async function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  }
}

// Search

// Returns an array of file paths in current repo matching the fileName
async function findFilePaths(fileName) {
  const items = await await vstsGot()
    .getGitApi()
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

// Branch

// private getRef
async function getRef(branchName) {
  return vstsGot()
    .getGitApi()
    .getRefs(
      config.repoId,
      null,
      helper.getBranchNameWithoutRefsPrefix(branchName)
    );
}

// Returns true if branch exists, otherwise false
async function branchExists(branchName) {
  logger.debug(`Checking if branch exists: ${branchName}`);
  const branchs = await getRef(branchName);
  if (branchs.length === 0) {
    return false;
  }
  return true;
}

async function getAllRenovateBranches() {
  throw new Error(`vsts error: getAllRenovateBranches()`);
  // logger.trace('getAllRenovateBranches');
  // const allBranches = (await ghGotRetry(
  //   `repos/${config.repoName}/git/refs/heads`
  // )).body;
  // return allBranches.reduce((arr, branch) => {
  //   if (branch.ref.indexOf('refs/heads/renovate/') === 0) {
  //     arr.push(branch.ref.substring('refs/heads/'.length));
  //   }
  //   return arr;
  // }, []);
}

async function isBranchStale(branchName) {
  // Check if branch's parent SHA = master SHA
  logger.debug(`isBranchStale(${branchName})`);
  const branchCommit = await getBranchCommit(branchName);
  logger.debug(`branchCommit=${branchCommit}`);
  const commitDetails = await getCommitDetails(branchCommit);
  logger.debug({ commitDetails }, `commitDetails`);
  const parentSha = commitDetails.parents[0].sha;
  logger.debug(`parentSha=${parentSha}`);
  // Return true if the SHAs don't match
  return parentSha !== config.baseCommitSHA;
}

// Returns the Pull Request for a branch. Null if not exists.
async function getBranchPr(branchName) {
  logger.warn(
    `getBranchPr(branchName) not implemented for VSTS yet... (${branchName})`
  );
  return null;
  // logger.debug(`getBranchPr(${branchName})`);
  // const gotString =
  //   `repos/${config.repoName}/pulls?` +
  //   `state=open&base=${config.baseBranch}&head=${config.owner}:${branchName}`;
  // const res = await ghGotRetry(gotString);
  // if (!res.body.length) {
  //   return null;
  // }
  // const prNo = res.body[0].number;
  // return getPr(prNo);
}

// Returns the combined status for a branch.
async function getBranchStatus(branchName, requiredStatusChecks) {
  throw new Error(
    `vsts error: getBranchStatus(${branchName},${requiredStatusChecks})`
  );
  // logger.debug(`getBranchStatus(${branchName})`);
  // if (!requiredStatusChecks) {
  //   // null means disable status checks, so it always succeeds
  //   return 'success';
  // }
  // if (requiredStatusChecks.length) {
  //   // This is Unsupported
  //   logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
  //   return 'failed';
  // }
  // const gotString = `repos/${config.repoName}/commits/${branchName}/status`;
  // logger.debug(gotString);
  // const res = await ghGotRetry(gotString);
  // return res.body.state;
}

async function deleteBranch(branchName) {
  throw new Error(`vsts error: deleteBranch(${branchName})`);
  // await ghGotRetry.delete(
  //   `repos/${config.repoName}/git/refs/heads/${branchName}`
  // );
}

async function mergeBranch(branchName, mergeType) {
  throw new Error(`vsts error: mergeBranch(${branchName}, ${mergeType})`);
  // logger.debug(`mergeBranch(${branchName}, ${mergeType})`);
  // if (mergeType === 'branch-push') {
  //   const url = `repos/${config.repoName}/git/refs/heads/${config.baseBranch}`;
  //   const options = {
  //     body: {
  //       sha: await getBranchCommit(branchName),
  //     },
  //   };
  //   try {
  //     await ghGotRetry.patch(url, options);
  //   } catch (err) {
  //     logger.error({ err }, `Error pushing branch merge for ${branchName}`);
  //     throw new Error('branch-push failed');
  //   }
  // } else if (mergeType === 'branch-merge-commit') {
  //   const url = `repos/${config.repoName}/merges`;
  //   const options = {
  //     body: {
  //       base: config.baseBranch,
  //       head: branchName,
  //     },
  //   };
  //   try {
  //     await ghGotRetry.post(url, options);
  //   } catch (err) {
  //     logger.error({ err }, `Error pushing branch merge for ${branchName}`);
  //     throw new Error('branch-push failed');
  //   }
  // } else {
  //   throw new Error(`Unsupported branch merge type: ${mergeType}`);
  // }
  // // Update base commit
  // config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  // // Delete branch
  // await deleteBranch(branchName);
}

// Issue

async function addAssignees(issueNo, assignees) {
  throw new Error(`vsts error: addAssignees(${issueNo}, ${assignees})`);
  // logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  // await ghGotRetry.post(
  //   `repos/${config.repoName}/issues/${issueNo}/assignees`,
  //   {
  //     body: {
  //       assignees,
  //     },
  //   }
  // );
}

async function addReviewers(issueNo, reviewers) {
  throw new Error(`vsts error: addReviewers(${issueNo}, ${reviewers})`);
  // logger.debug(`Adding reviewers ${reviewers} to #${issueNo}`);
  // await ghGotRetry.post(
  //   `repos/${config.repoName}/pulls/${issueNo}/requested_reviewers`,
  //   {
  //     headers: {
  //       accept: 'application/vnd.vsts.black-cat-preview+json',
  //     },
  //     body: {
  //       reviewers,
  //     },
  //   }
  // );
}

async function addLabels(issueNo, labels) {
  throw new Error(`vsts error: addLabels(${issueNo}, ${labels})`);
  // logger.debug(`Adding labels ${labels} to #${issueNo}`);
  // await ghGotRetry.post(`repos/${config.repoName}/issues/${issueNo}/labels`, {
  //   body: labels,
  // });
}

async function findPr(branchName, prTitle, state = 'all') {
  logger.debug(`findPr(${branchName}, ${state})`);
  const prs = await vstsGot().getGitApi().getPullRequests(config.repoId, null);
  let pr = null;
  const prsFiltered = prs.filter(item => item.title === prTitle);
  prsFiltered.forEach(item => {
    pr = item;
    if (item.status === 2 || item.status === 3) {
      pr.isClosed = true;
    }
    pr.displayNumber = `Pull Request #${pr.pullRequestId}`;
  });
  return pr;
}

// Pull Request
async function checkForClosedPr(branchName, prTitle) {
  throw new Error(`vsts error: checkForClosedPr(${branchName}, ${prTitle})`);
  // logger.debug(`checkForClosedPr(${branchName}, ${prTitle})`);
  // const url = `repos/${config.repoName}/pulls?state=closed&head=${config.owner}:${branchName}`;
  // const res = await ghGotRetry(url);
  // // Return true if any of the titles match exactly
  // return res.body.some(
  //   pr =>
  //     pr.title === prTitle && pr.head.label === `${config.owner}:${branchName}`
  // );
}

// Creates PR and returns PR number
async function createPr(branchName, title, body, useDefaultBranch) {
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  const pr = await vstsGot().getGitApi().createPullRequest(
    {
      sourceRefName: helper.getNewBranchName(branchName),
      targetRefName: base,
      title,
      description: body,
    },
    config.repoId
  );
  pr.displayNumber = `Pull Request #${pr.pullRequestId}`;
  return pr;
}

// Gets details for a PR
async function getPr(prNo) {
  throw new Error(`vsts error: getPr(${prNo})`);
  // if (!prNo) {
  //   return null;
  // }
  // const pr = (await ghGotRetry(`repos/${config.repoName}/pulls/${prNo}`)).body;
  // if (!pr) {
  //   return null;
  // }
  // // Harmonise PR values
  // pr.displayNumber = `Pull Request #${pr.number}`;
  // if (pr.state === 'closed') {
  //   pr.isClosed = true;
  // }
  // if (!pr.isClosed) {
  //   if (pr.mergeable_state === 'dirty') {
  //     logger.debug(`PR mergeable state is dirty`);
  //     pr.isUnmergeable = true;
  //   }
  //   if (pr.commits === 1) {
  //     // Only one commit was made - must have been renovate
  //     logger.debug('Only 1 commit in PR so rebase is possible');
  //     pr.canRebase = true;
  //   } else {
  //     // Check if only one author of all commits
  //     logger.debug('Checking all commits');
  //     const prCommits = (await ghGotRetry(
  //       `repos/${config.repoName}/pulls/${prNo}/commits`
  //     )).body;
  //     const authors = prCommits.reduce((arr, commit) => {
  //       logger.trace({ commit }, `Checking commit`);
  //       let author = 'unknown';
  //       if (commit.author) {
  //         author = commit.author.login;
  //       } else if (commit.commit && commit.commit.author) {
  //         author = commit.commit.author.email;
  //       } else {
  //         logger.debug('Could not determine commit author');
  //       }
  //       logger.debug(`Commit author is: ${author}`);
  //       if (arr.indexOf(author) === -1) {
  //         arr.push(author);
  //       }
  //       return arr;
  //     }, []);
  //     logger.debug(`Author list: ${authors}`);
  //     if (authors.length === 1) {
  //       pr.canRebase = true;
  //     }
  //   }
  //   if (pr.base.sha !== config.baseCommitSHA) {
  //     pr.isStale = true;
  //   }
  // }
  // return pr;
}

async function getAllPrs() {
  throw new Error(`vsts error: getAllPrs()`);
  // const all = (await ghGotRetry(`repos/${config.repoName}/pulls?state=open`))
  //   .body;
  // return all.map(pr => ({
  //   number: pr.number,
  //   branchName: pr.head.ref,
  // }));
}

async function updatePr(prNo, title, body) {
  throw new Error(`vsts error: updatePr(${prNo}, ${title}, ${body})`);
  // await ghGotRetry.patch(`repos/${config.repoName}/pulls/${prNo}`, {
  //   body: { title, body },
  // });
}

async function mergePr(pr) {
  throw new Error(`vsts error: mergePr(${pr})`);
  // const url = `repos/${config.repoName}/pulls/${pr.number}/merge`;
  // const options = {
  //   body: {},
  // };
  // if (config.mergeMethod) {
  //   // This path is taken if we have auto-detected the allowed merge types from the repo
  //   options.body.merge_method = config.mergeMethod;
  //   try {
  //     logger.debug({ options, url }, `mergePr`);
  //     await ghGotRetry.put(url, options);
  //   } catch (err) {
  //     logger.error({ err }, `Failed to ${options.body.merge_method} PR`);
  //     return;
  //   }
  // } else {
  //   // We need to guess the merge method and try squash -> rebase -> merge
  //   options.body.merge_method = 'rebase';
  //   try {
  //     logger.debug({ options, url }, `mergePr`);
  //     await ghGotRetry.put(url, options);
  //   } catch (err1) {
  //     logger.debug({ err: err1 }, `Failed to ${options.body.merge_method} PR`);
  //     try {
  //       options.body.merge_method = 'squash';
  //       logger.debug({ options, url }, `mergePr`);
  //       await ghGotRetry.put(url, options);
  //     } catch (err2) {
  //       logger.debug(
  //         { err: err2 },
  //         `Failed to ${options.body.merge_method} PR`
  //       );
  //       try {
  //         options.body.merge_method = 'merge';
  //         logger.debug({ options, url }, `mergePr`);
  //         await ghGotRetry.put(url, options);
  //       } catch (err3) {
  //         logger.debug(
  //           { err: err3 },
  //           `Failed to ${options.body.merge_method} PR`
  //         );
  //         logger.warn('All merge attempts failed');
  //         return;
  //       }
  //     }
  //   }
  // }
  // // Update base branch SHA
  // config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  // // Delete branch
  // await deleteBranch(pr.head.ref);
}

// Generic File operations

async function getFile(filePath, branchName = config.baseBranch) {
  try {
    const item = await vstsGot()
      .getGitApi()
      .getItemText(
        config.repoId,
        filePath,
        config.repoName,
        null,
        0,
        false,
        false,
        true,
        {
          versionType: 0,
          version: helper.getBranchNameWithoutRefsheadsPrefix(branchName),
        }
      );
    if (item && item.readable) {
      return item.read();
    }
  } catch (error) {
    // file not found
    // logger.error(error);
  }
  return null;
}

async function getFileContent(filePath, branchName = config.baseBranch) {
  logger.trace(
    `getFileContent(filePath=${filePath}, branchName=${branchName})`
  );
  try {
    const file = await getFile(filePath, branchName);
    if (!file) {
      return null;
    }
    const str = new Buffer(file, 'base64').toString();
    try {
      const jTmp = JSON.parse(str);
      if (jTmp.typeKey === 'GitItemNotFoundException') {
        // file not found
        return null;
      } else if (jTmp.typeKey === 'GitUnresolvableToCommitException') {
        // branch not found
        return null;
      }
    } catch (error) {
      // not a json file and found!
    }
    return str;
  } catch (error) {
    if (error.statusCode === 404) {
      // If file not found, then return null JSON
      return null;
    }
    // Propagate if it's any other error
    throw error;
  }
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

async function getSubDirectories(path) {
  throw new Error(`vsts error: getSubDirectories(${path})`);
  // logger.trace(`getSubDirectories(path=${path})`);
  // const res = await ghGotRetry(`repos/${config.repoName}/contents/${path}`);
  // const directoryList = [];
  // res.body.forEach(item => {
  //   if (item.type === 'dir') {
  //     directoryList.push(item.name);
  //   }
  // });
  // return directoryList;
}

// Add a new commit, create branch if not existing
async function commitFilesToBranch(
  branchName,
  files,
  message,
  parentBranch = config.baseBranch
) {
  logger.debug(
    `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
  );

  // Get the default branch
  const branchs = await getRef(parentBranch);

  // Create the new Branch
  const newBranch = helper.getVSTSBranchObj(branchName, branchs[0].objectId);

  // create commits
  const commits = [];
  for (const file of files) {
    commits.push(helper.getVSTSCommitObj(message, file.name, file.contents));
  }

  const isBranchExisting = await branchExists(branchName);
  if (isBranchExisting) {
    logger.error(
      'await updateBranch(branchName, commit) is not managed in vsts'
    );
    // await updateBranch(branchName, commit);
  } else {
    // await createBranch(branchName, commit);
    await vstsGot().getGitApi().createPush(
      {
        commits,
        refUpdates: [newBranch],
      },
      config.repoId
    );
  }
}

// Internal branch operations

// Creates a new branch with provided commit
async function createBranch(branchName, commit = config.baseCommitSHA) {
  throw new Error(`vsts error: createBranch(${branchName}, ${commit})`);
  // await ghGotRetry.post(`repos/${config.repoName}/git/refs`, {
  //   body: {
  //     ref: `refs/heads/${branchName}`,
  //     sha: commit,
  //   },
  // });
}

// Internal: Updates an existing branch to new commit sha
async function updateBranch(branchName, commit) {
  throw new Error(`vsts error: updateBranch(${branchName}, ${commit})`);
  // logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  // await ghGotRetry.patch(
  //   `repos/${config.repoName}/git/refs/heads/${branchName}`,
  //   {
  //     body: {
  //       sha: commit,
  //       force: true,
  //     },
  //   }
  // );
}

// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(fileContents) {
  throw new Error(`vsts error: createBlob(${fileContents}`);
  // logger.debug('Creating blob');
  // return (await ghGotRetry.post(`repos/${config.repoName}/git/blobs`, {
  //   body: {
  //     encoding: 'base64',
  //     content: new Buffer(fileContents).toString('base64'),
  //   },
  // })).body.sha;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName) {
  const commit = await vstsGot()
    .getGitApi()
    .getBranch(
      config.repoId,
      helper.getBranchNameWithoutRefsheadsPrefix(branchName),
      config.repoName
    );
  return commit.commit.commitId;
}

async function getCommitDetails(commit) {
  throw new Error(`vsts error: getCommitDetails(${commit}`);
  // logger.debug(`getCommitDetails(${commit})`);
  // const results = await ghGotRetry(
  //   `repos/${config.repoName}/git/commits/${commit}`
  // );
  // return results.body;
}

// Return the tree SHA for a commit
async function getCommitTree(branchName) {
  logger.debug(`getCommitTree(${branchName})`);
  const commit = await vstsGot()
    .getGitApi()
    .getBranch(
      config.repoId,
      helper.getBranchNameWithoutRefsheadsPrefix(branchName),
      config.repoName
    );
  return commit.commit.treeId;
}

// Create a tree and return SHA
async function createTree(baseTree, files) {
  throw new Error(`vsts error: createTree(${baseTree},${files}`);
  // logger.debug(`createTree(${baseTree}, files)`);
  // const body = {
  //   base_tree: baseTree,
  //   tree: [],
  // };
  // files.forEach(file => {
  //   body.tree.push({
  //     path: file.name,
  //     mode: '100644',
  //     type: 'blob',
  //     sha: file.blob,
  //   });
  // });
  // logger.trace({ body }, 'createTree body');
  // return (await ghGotRetry.post(`repos/${config.repoName}/git/trees`, { body }))
  //   .body.sha;
}

// Create a commit and return commit SHA
async function createCommit(parent, tree, message) {
  throw new Error(`vsts error: createCommit(${parent},${tree},${message}`);
  // logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  // return (await ghGotRetry.post(`repos/${config.repoName}/git/commits`, {
  //   body: {
  //     message,
  //     parents: [parent],
  //     tree,
  //   },
  // })).body.sha;
}

async function getCommitMessages() {
  logger.debug('getCommitMessages');
  return [];
  // try {
  //   const res = await ghGotRetry(`repos/${config.repoName}/commits`);
  //   return res.body.map(commit => commit.commit.message);
  // } catch (err) {
  //   logger.error({ err }, `getCommitMessages error`);
  //   return [];
  // }
}
