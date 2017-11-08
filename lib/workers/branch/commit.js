const handlebars = require('handlebars');

module.exports = {
  commitFilesToBranch,
};

async function commitFilesToBranch(config) {
  const updatedFiles = config.updatedPackageFiles.concat(
    config.updatedLockFiles
  );
  if (updatedFiles.length) {
    logger.debug(`${updatedFiles.length} file(s) to commit`);
    let commitMessage = handlebars.compile(config.commitMessage)(config);
    if (config.semanticCommits) {
      const splitMessage = commitMessage.split('\n');
      splitMessage[0] = splitMessage[0].toLowerCase();
      commitMessage = `${config.semanticPrefix} ${splitMessage.join('\n')}`;
    }
    // API will know whether to create new branch or not
    await platform.commitFilesToBranch(
      config.branchName,
      updatedFiles,
      commitMessage,
      config.parentBranch
    );
  } else {
    logger.debug(`No files to commit`);
  }
}
