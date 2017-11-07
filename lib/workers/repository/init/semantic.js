const platform = require('../../../platform');
const conventionalCommitsDetector = require('conventional-commits-detector');

async function detectSemanticCommits(config) {
  const { logger } = config;
  if (config.semanticCommits !== null) {
    return config;
  }
  const commitMessages = await platform.getCommitMessages();
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  if (type === 'unknown') {
    logger.debug('No semantic commit type found');
    return { ...config, semanticCommits: false };
  }
  logger.debug(
    `Found semantic commit type ${type} - enabling semantic commits`
  );
  return { ...config, semanticCommits: true };
}

module.exports = {
  detectSemanticCommits,
};
