module.exports = {
  extractDependencies,
};

function extractDependencies(content, config) {
  const { logger } = config;
  const strippedComment = content.replace(/^(#.*?\n)+/, '');
  const fromMatch = strippedComment.match(/^FROM (.*)\n/);
  if (!fromMatch) {
    logger.warn({ content, strippedComment }, 'No FROM found');
    return [];
  }
  const [, currentFrom] = fromMatch;
  const [imagetag, currentDigest] = currentFrom.split('@');
  const [depName, currentTag] = imagetag.split(':');
  logger.info({ depName, currentTag, currentDigest }, 'Dockerfile');
  return [
    {
      depType: 'Dockerfile',
      depName,
      currentFrom,
      currentTag: currentTag || 'latest',
      currentDigest,
    },
  ];
}
