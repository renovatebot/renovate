const { splitImageParts } = require('../docker/extract');

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('docker-compose.extractDependencies()');
  const deps = [];
  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*- image:\s*'?"?([^\s'"]+)'?"?\s*$/);
    if (match) {
      const currentFrom = match[1];
      const {
        dockerRegistry,
        depName,
        currentTag,
        currentDigest,
        currentDepTagDigest,
        currentDepTag,
      } = splitImageParts(currentFrom);
      logger.info(
        { dockerRegistry, depName, currentTag, currentDigest },
        'CircleCI docker image'
      );
      deps.push({
        depType: 'CircleCI',
        lineNumber,
        currentFrom,
        changeLogFromVersion: currentFrom,
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
