const is = require('@sindresorhus/is');

module.exports = {
  commitFilesToBranch,
};

async function commitFilesToBranch(config) {
  const updatedFiles = config.updatedPackageFiles.concat(
    config.updatedLockFiles
  );
  if (is.nonEmptyArray(updatedFiles)) {
    logger.debug(`${updatedFiles.length} file(s) to commit`);

    // istanbul ignore if
    if (config.dryRun) {
      logger.info('DRY-RUN: Would commit files to branch ' + config.branchName);
    } else {
      // API will know whether to create new branch or not
      const res = await platform.commitFilesToBranch(
        config.branchName,
        updatedFiles,
        config.commitMessage,
        config.parentBranch || config.baseBranch || undefined
      );
      if (res) {
        logger.info({ branch: config.branchName }, `Branch ${res}`);
      }
    }
  } else {
    logger.debug(`No files to commit`);
    return false;
  }
  return true;
}
