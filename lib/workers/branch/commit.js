const is = require('@sindresorhus/is');

module.exports = {
  commitFilesToBranch,
};

async function commitFilesToBranch(config) {
  const updatedFiles = config.updatedPackageFiles.concat(
    config.updatedLockFiles
  );
  if (!is.empty(updatedFiles)) {
    logger.debug(`${updatedFiles.length} file(s) to commit`);

    // API will know whether to create new branch or not
    await platform.commitFilesToBranch(
      config.branchName,
      updatedFiles,
      config.commitMessage,
      config.parentBranch || config.baseBranch || undefined
    );
  } else {
    logger.debug(`No files to commit`);
    return false;
  }
  return true;
}
