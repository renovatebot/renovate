const conventionalCommitsDetector = require('conventional-commits-detector');

async function detectSemanticCommits(config) {
  if (config.semanticCommits !== null) {
    return config.semanticCommits;
  }
  const commitMessages = await platform.getCommitMessages();
  if (commitMessages) {
    commitMessages.length = 10;
  }
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  logger.debug({ type }, 'Semantic commits detection');
  if (type === 'angular') {
    logger.info('angular semantic commits detected');
    return true;
  }
  logger.info('No semantic commits detected');
  return false;
}

module.exports = {
  detectSemanticCommits,
};
