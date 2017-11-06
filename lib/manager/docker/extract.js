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
  const [fromPrefix, currentFrom, ...fromRest] = fromLine.split(' ');
  const fromSuffix = fromRest.join(' ');
  const [currentDepTag, currentDigest] = currentFrom.split('@');
  const [depName, currentTag] = currentDepTag.split(':');
  logger.info({ depName, currentTag, currentDigest }, 'Dockerfile FROM');
  return [
    {
      depType: 'Dockerfile',
      fromLine,
      fromPrefix,
      currentFrom,
      fromSuffix,
      currentDepTag,
      currentDigest,
      depName,
      currentTag,
    },
  ];
}
