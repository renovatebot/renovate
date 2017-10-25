module.exports = {
  extractDependencies,
};

function extractDependencies(config) {
  const { logger } = config;
  const [imagetag, currentDigest] = config.currentFrom.split('@');
  const [depName, currentTag] = imagetag.split(':');
  logger.info({ depName, currentTag, currentDigest }, 'Dockerfile');
  return [
    {
      depType: 'Dockerfile',
      depName,
      currentTag: currentTag || 'latest',
      currentDigest,
    },
  ];
}
