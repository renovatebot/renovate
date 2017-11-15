const conventionalCommitsDetector = require('conventional-commits-detector');

async function detectSemanticCommits(config) {
  if (config.semanticCommits !== null) {
    return config.semanticCommits;
  }
  const commitMessages = await platform.getCommitMessages();
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  if (type === 'unknown') {
    logger.debug('No semantic commit type found');
    return false;
  }
  logger.debug(
    `Found semantic commit type ${type} - enabling semantic commits`
  );
  return true;
}

module.exports = {
  detectSemanticCommits,
};
