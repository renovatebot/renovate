const vsts = require('vso-node-api');
let logger = require('../logger');

module.exports = {
  gitApi,
  getBranchNameWithoutRefsheadsPrefix,
  getRef,
  getVSTSBranchObj,
  getVSTSCommitObj,
  getNewBranchName
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
  if (!branchPath.startsWith('refs/heads/')) {
    logger.trace(
      `The refs/heads/ name should have started with 'refs/heads/' but it didn't. (${branchPath})`
    );
    return branchPath;
  }
  return branchPath.substring(11, branchPath.lenght);
}

function getBranchNameWithoutRefsPrefix(branchPath) {
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

function getVSTSCommitObj(msg, filePath, fileContent) {
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
        changeType: 1,//1 is add, 2 is edit
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