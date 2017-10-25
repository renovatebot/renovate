const vsts = require('vso-node-api');
let logger = require('../logger');

module.exports = {
  gitApi,
  getBranchNameWithoutRefsheadsPrefix,
  getRef,
  getVSTSBranchObj,
  getVSTSCommitObj,
  getNewBranchName,
  getFile
};

function gitApi() {
  const authHandler = vsts.getPersonalAccessTokenHandler(
    process.env.VSTS_TOKEN
  );
  const connect = new vsts.WebApi(process.env.VSTS_ENDPOINT, authHandler);
  return connect.getGitApi();
}

function getNewBranchName(branchName) {
  return `refs/heads/${branchName}`;
}

function getBranchNameWithoutRefsheadsPrefix(branchPath) {
  if(!branchPath){
    logger.error(`getBranchNameWithoutRefsheadsPrefix(${branchPath})`);
  }
  if (!branchPath.startsWith('refs/heads/')) {
    logger.trace(
      `The refs/heads/ name should have started with 'refs/heads/' but it didn't. (${branchPath})`
    );
    return branchPath;
  }
  return branchPath.substring(11, branchPath.lenght);
}

function getBranchNameWithoutRefsPrefix(branchPath) {
  if(!branchPath){
    logger.error(`getBranchNameWithoutRefsPrefix(${branchPath})`);
  }
  if (!branchPath.startsWith('refs/')) {
    logger.trace(
      `The ref name should have started with 'refs/' but it didn't. (${branchPath})`
    );
    return branchPath;
  }
  return branchPath.substring(5, branchPath.lenght);
}

async function getRef(repoId, branchName) {
  return gitApi().getRefs(repoId, null, getBranchNameWithoutRefsPrefix(branchName));
}

function getVSTSBranchObj(branchName, oldObjectId) {
  return {
    name: getNewBranchName(branchName),
    oldObjectId,
  };
}

async function getVSTSCommitObj(msg, filePath, fileContent, repoId, repoName, branchName) {

  //Add or update
  let changeType = 1;
  const fileAlreadyThere = await getFile(repoId, repoName, filePath, branchName);
  if(fileAlreadyThere){
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
        changeType: changeType,
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

// if no branchName, look globaly
async function getFile(repoId, repoName, filePath, branchName) {
  logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
  const descriptor = {
    versionType: 0,
    version: getBranchNameWithoutRefsheadsPrefix(branchName),
  };
  const item = await gitApi()
    .getItemText(repoId, filePath, repoName, null, 0, false, false, true, branchName ? descriptor : null);
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