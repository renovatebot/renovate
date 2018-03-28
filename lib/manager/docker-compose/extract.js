module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('docker-compose.extractDependencies()');
  const deps = [];
  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*image:\s*([^\s]+)\s*$/);
    if (match) {
      const currentFrom = match[1];
      let dockerRegistry;
      const split = currentFrom.split('/');
      if (split.length > 1 && split[0].includes('.')) {
        [dockerRegistry] = split;
        split.shift();
      }
      const currentDepTagDigest = split.join('/');
      const [currentDepTag, currentDigest] = currentDepTagDigest.split('@');
      const [depName, currentTag] = currentDepTag.split(':');
      logger.info(
        { dockerRegistry, depName, currentTag, currentDigest },
        'Docker Compose image'
      );
      deps.push({
        depType: 'Docker Compose',
        lineNumber,
        currentFrom,
        currentDepTagDigest,
        dockerRegistry,
        currentDepTag,
        currentDigest,
        depName,
        currentTag,
      });
    }
    lineNumber += 1;
  }
  return deps;
}
