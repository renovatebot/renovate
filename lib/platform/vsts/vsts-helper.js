// @ts-nocheck

const gitApi = require('./vsts-got-wrapper');

module.exports = {
  setTokenAndEndpoint,
  getBranchNameWithoutRefsheadsPrefix,
  getRefs,
  getVSTSBranchObj,
  getChanges,
  getNewBranchName,
  getFile,
  max4000Chars,
  getRenovatePRFormat,
  getCommitDetails,
};

/**
 *
 * @param {string} token
 * @param {string} endpoint
 */
function setTokenAndEndpoint(token, endpoint) {
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

/**
 *
 * @param {string} branchName
 */
function getNewBranchName(branchName) {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}

/**
 *
 * @param {string} branchPath
 */
function getBranchNameWithoutRefsheadsPrefix(branchPath) {
  if (!branchPath) {
    logger.error(`getBranchNameWithoutRefsheadsPrefix(${branchPath})`);
    return null;
  }
  if (!branchPath.startsWith('refs/heads/')) {
    logger.trace(
      `The refs/heads/ name should have started with 'refs/heads/' but it didn't. (${
        branchPath
      })`
    );
    return branchPath;
  }
  return branchPath.substring(11, branchPath.length);
}

/**
 *
 * @param {string} branchPath
 */
function getBranchNameWithoutRefsPrefix(branchPath) {
  if (!branchPath) {
    logger.error(`getBranchNameWithoutRefsPrefix(${branchPath})`);
    return null;
  }
  if (!branchPath.startsWith('refs/')) {
    logger.trace(
      `The ref name should have started with 'refs/' but it didn't. (${
        branchPath
      })`
    );
    return branchPath;
  }
  return branchPath.substring(5, branchPath.length);
}

/**
 *
 * @param {string} repoId
 * @param {string} branchName
 */
async function getRefs(repoId, branchName) {
  logger.debug(`getRefs(${repoId}, ${branchName})`);
  const refs = await gitApi().getRefs(
    repoId,
    null,
    getBranchNameWithoutRefsPrefix(branchName)
  );
  return refs;
}

/**
 *
 * @param {string} branchName
 * @param {string} from
 */
async function getVSTSBranchObj(repoId, branchName, from) {
  const fromBranchName = getNewBranchName(from);
  const refs = await getRefs(repoId, fromBranchName);
  if (refs.length === 0) {
    logger.debug(`getVSTSBranchObj without a valid from, so initial commit.`);
    return {
      name: getNewBranchName(branchName),
      oldObjectId: '0000000000000000000000000000000000000000',
    };
  }
  return {
    name: getNewBranchName(branchName),
    oldObjectId: refs[0].objectId,
  };
}
/**
 *
 * @param {string} msg
 * @param {string} filePath
 * @param {string} fileContent
 * @param {string} repoId
 * @param {string} repoName
 * @param {string} branchName
 */
async function getChanges(files, repoId, repoName, branchName) {
  const changes = [];
  for (const file of files) {
    // Add or update
    let changeType = 1;
    const fileAlreadyThere = await getFile(
      repoId,
      repoName,
      file.name,
      branchName
    );
    if (fileAlreadyThere) {
      changeType = 2;
    }

    changes.push({
      changeType,
      item: {
        path: file.name,
      },
      newContent: {
        Content: file.contents,
        ContentType: 0, // RawText
      },
    });
  }

  return changes;
}

/**
 * if no branchName, look globaly
 * @param {string} repoId
 * @param {string} repoName
 * @param {string} filePath
 * @param {string} branchName
 */
async function getFile(repoId, repoName, filePath, branchName) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const item = await gitApi().getItemText(
    repoId,
    filePath,
    null,
    null,
    0, // because we look for 1 file
    false,
    false,
    true,
    {
      versionType: 0, // branch
      versionOptions: 0,
      version: getBranchNameWithoutRefsheadsPrefix(branchName),
    }
  );

  if (item && item.readable) {
    const buffer = item.read();
    // @ts-ignore
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
      // it 's not a JSON, so I send the content directly with the line under
    }
    return fileContent;
  }
  return null; // no file found
}

/**
 *
 * @param {string} str
 */
function max4000Chars(str) {
  if (str.length >= 4000) {
    return str.substring(0, 3999);
  }
  return str;
}

function getRenovatePRFormat(vstsPr) {
  const pr = vstsPr;

  pr.displayNumber = `Pull Request #${vstsPr.pullRequestId}`;
  pr.number = vstsPr.pullRequestId;

  // status
  // export declare enum PullRequestStatus {
  //   NotSet = 0,
  //   Active = 1,
  //   Abandoned = 2,
  //   Completed = 3,
  //   All = 4,
  // }

  if (vstsPr.status === 2 || vstsPr.status === 3) {
    pr.isClosed = true;
  } else {
    pr.isClosed = false;
  }

  // mergeStatus
  // export declare enum PullRequestAsyncStatus {
  //   NotSet = 0,
  //   Queued = 1,
  //   Conflicts = 2,
  //   Succeeded = 3,
  //   RejectedByPolicy = 4,
  //   Failure = 5,
  // }
  if (vstsPr.mergeStatus === 2) {
    pr.isUnmergeable = true;
  }

  pr.canRebase = true;

  return pr;
}

async function getCommitDetails(commit, repoId) {
  logger.debug(`getCommitDetails(${commit}, ${repoId})`);
  const results = await gitApi().getCommit(commit, repoId);
  return results;
}
