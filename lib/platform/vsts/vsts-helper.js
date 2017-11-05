// @ts-check

const vsts = require('vso-node-api');
const logger = require('../../logger');

module.exports = {
  setTokenAndEndpoint,
  gitApi,
  getBranchNameWithoutRefsheadsPrefix,
  getRef,
  getVSTSBranchObj,
  getVSTSCommitObj,
  getNewBranchName,
  getFile,
  max4000Chars,
  getRenovatePRFormat,
};

function gitApi() {
  const authHandler = vsts.getPersonalAccessTokenHandler(
    process.env.VSTS_TOKEN
  );
  const connect = new vsts.WebApi(process.env.VSTS_ENDPOINT, authHandler);
  return connect.getGitApi();
}

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
  return `refs/heads/${branchName}`;
}

/**
 *
 * @param {string} branchPath
 */
function getBranchNameWithoutRefsheadsPrefix(branchPath) {
  if (!branchPath) {
    logger.error(`getBranchNameWithoutRefsheadsPrefix(${branchPath})`);
  }
  if (!branchPath.startsWith('refs/heads/')) {
    logger.trace(
      `The refs/heads/ name should have started with 'refs/heads/' but it didn't. (${branchPath})`
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
  }
  if (!branchPath.startsWith('refs/')) {
    logger.trace(
      `The ref name should have started with 'refs/' but it didn't. (${branchPath})`
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
function getRef(repoId, branchName) {
  return gitApi().getRefs(
    repoId,
    null,
    getBranchNameWithoutRefsPrefix(branchName)
  );
}

/**
 *
 * @param {string} branchName
 * @param {string} oldObjectId
 */
function getVSTSBranchObj(branchName, oldObjectId) {
  return {
    name: getNewBranchName(branchName),
    oldObjectId,
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
async function getVSTSCommitObj(
  msg,
  filePath,
  fileContent,
  repoId,
  repoName,
  branchName
) {
  // Add or update
  let changeType = 1;
  const fileAlreadyThere = await getFile(
    repoId,
    repoName,
    filePath,
    branchName
  );
  if (fileAlreadyThere) {
    changeType = 2;
  }

  return {
    comment: msg,
    author: {
      name: 'VSTS Renovate', // Todo... this is not working
    },
    committer: {
      name: 'VSTS Renovate', // Todo... this is not working
    },
    changes: [
      {
        changeType,
        item: {
          path: filePath,
        },
        newContent: {
          Content: fileContent,
          ContentType: 0, // RawText
        },
      },
    ],
  };
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
    repoName,
    null,
    0,
    false,
    false,
    true,
    {
      versionType: 0,
      versionOptions: 2,
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
      return null;
    }
    return fileContent;
  }
  return null;
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
  if (vstsPr.status === 2 || vstsPr.status === 3) {
    pr.isClosed = true;
  } else {
    pr.isClosed = false;
  }
  pr.displayNumber = `Pull Request #${vstsPr.pullRequestId}`;
  pr.number = vstsPr.pullRequestId;
  if (vstsPr.mergeStatus === 2) {
    pr.isUnmergeable = true;
  }
  return pr;
}
