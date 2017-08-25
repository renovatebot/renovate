const handlebars = require('handlebars');

module.exports = {
  commitFilesToBranch,
};

async function commitFilesToBranch(config) {
  const { logger } = config;
  const updatedFiles = config.updatedPackageFiles.concat(
    config.updatedLockFiles
  );
  if (updatedFiles.length) {
    logger.debug(`${updatedFiles.length} file(s) to commit`);
    let commitMessage = handlebars.compile(config.commitMessage)(config);
    if (config.semanticCommits) {
      commitMessage = `${config.semanticPrefix} ${commitMessage.toLowerCase()}`;
    }
    // API will know whether to create new branch or not
    await config.api.commitFilesToBranch(
      config.branchName,
      updatedFiles,
      commitMessage,
      config.parentBranch
    );
  } else {
    logger.debug(`No files to commit`);
  }
}
