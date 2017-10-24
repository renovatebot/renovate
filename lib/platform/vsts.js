let logger = require('../logger');

const config = {};

module.exports = {
  // vsts App
    // getInstallations,                  //Not supported
    // getInstallationToken,              //Not supported
    // getInstallationRepositories,       //Not supported
  // Initialization
  getRepos,                               //Not supported
  initRepo,
  setBaseBranch,
  // Search
  findFilePaths,
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
  addLabels,
  // Comments
  getComments,
  addComment,
  editComment,
  deleteComment,
  ensureComment,
  ensureCommentRemoval,
  // PR
  getPrList,
  findPr,
  createPr,
  getPr,
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
  getBranchCommit,
  getCommitDetails,
};