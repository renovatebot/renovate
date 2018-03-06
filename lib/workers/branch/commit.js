const handlebars = require('handlebars');

module.exports = {
  commitFilesToBranch,
};

async function commitFilesToBranch(config) {
  const updatedFiles = config.updatedPackageFiles.concat(
    config.updatedLockFiles
  );
  if (updatedFiles && updatedFiles.length) {
    logger.debug(`${updatedFiles.length} file(s) to commit`);
    let commitMessage = handlebars.compile(config.commitMessage)(config);
    if (config.semanticCommits) {
      const splitMessage = commitMessage.split('\n');
      splitMessage[0] = splitMessage[0].toLowerCase();
      let semanticPrefix = config.semanticCommitType;
      if (config.semanticCommitScope) {
        semanticPrefix += `(${handlebars.compile(config.semanticCommitScope)(
          config
        )})`;
      }
      commitMessage = `${semanticPrefix}: ${splitMessage.join('\n')}`;
    }
    if (config.commitBody) {
      commitMessage = `${commitMessage}\n\n${handlebars.compile(
        config.commitBody
      )(config)}`;
    }
    // API will know whether to create new branch or not
    await platform.commitFilesToBranch(
      config.branchName,
      updatedFiles,
      commitMessage,
      config.parentBranch || config.baseBranch || undefined,
      config.gitAuthor,
      config.gitPrivateKey
    );
  } else {
    logger.debug(`No files to commit`);
    return false;
  }
  return true;
}
