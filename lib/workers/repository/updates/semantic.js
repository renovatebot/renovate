const conventionalCommitsDetector = require('conventional-commits-detector');

async function detectSemanticCommits(config) {
  logger.debug('detectSemanticCommits()');
  logger.trace({ config });
  if (config.semanticCommits !== null) {
    logger.debug(
      { semanticCommits: config.semanticCommits },
      `semanticCommits already defined`
    );
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
