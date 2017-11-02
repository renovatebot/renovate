module.exports = {
  extractDependencies,
};

function extractDependencies(content, config) {
  const { logger } = config;
  const fromMatch = content.match(/(\n|^)([Ff][Rr][Oo][Mm] .*)\n/);
  if (!fromMatch) {
    logger.warn({ content }, 'No FROM found');
    return [];
  }
  const [, , fromLine] = fromMatch;
  const [currentFrom] = fromLine.substring('FROM '.length).split(' as ');
  const [currentDepTag, currentDigest] = currentFrom.split('@');
  const [depName, currentTag] = currentDepTag.split(':');
  logger.info({ depName, currentTag, currentDigest }, 'Dockerfile');
  return [
    {
      depType: 'Dockerfile',
      fromLine,
      currentFrom,
      depName,
      currentDepTag,
      currentTag,
      currentDigest,
    },
  ];
}
