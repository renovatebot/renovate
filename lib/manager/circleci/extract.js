const { splitImageParts } = require('../docker/extract');

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('circleci.extractDependencies()');
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
        currentValue,
        tagSuffix,
      } = splitImageParts(currentFrom);
      logger.info(
        { dockerRegistry, depName, currentTag, currentDigest },
        'CircleCI docker image'
      );
      const dep = {
        lineNumber,
        currentFrom,
        fromVersion: currentFrom,
        currentDepTagDigest,
        dockerRegistry,
        currentDepTag,
        currentDigest,
        depName,
        currentTag,
        currentValue,
        tagSuffix,
        versionScheme: 'docker',
      };
      if (depName === 'node' || depName.endsWith('/node')) {
        dep.commitMessageTopic = 'Node.js';
      }
      deps.push(dep);
    }
    lineNumber += 1;
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
