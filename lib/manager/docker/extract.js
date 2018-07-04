module.exports = {
  splitImageParts,
  extractDependencies,
};

function splitImageParts(currentFrom) {
  let dockerRegistry;
  const split = currentFrom.split('/');
  if (split.length > 1 && split[0].includes('.')) {
    [dockerRegistry] = split;
    split.shift();
  }
  const currentDepTagDigest = split.join('/');
  const [currentDepTag, currentDigest] = currentDepTagDigest.split('@');
  const [depName, currentTag] = currentDepTag.split(':');
  let currentValue;
  let tagSuffix;
  if (currentTag) {
    [currentValue, ...tagSuffix] = currentTag.split('-');
    tagSuffix = tagSuffix && tagSuffix.length ? tagSuffix.join('-') : undefined;
  }
  return {
    dockerRegistry,
    depName,
    currentTag,
    currentDigest,
    currentDepTagDigest,
    currentDepTag,
    currentValue,
    tagSuffix,
  };
}

function extractDependencies(content) {
  const deps = [];
  const stageNames = [];
  let lineNumber = 0;
  for (const fromLine of content.split('\n')) {
    const match = fromLine.match(/^FROM /i);
    if (match) {
      logger.debug({ lineNumber, fromLine }, 'FROM line');
      const [fromPrefix, currentFrom, ...fromRest] = fromLine.match(/\S+/g);
      if (fromRest.length === 2 && fromRest[0].toLowerCase() === 'as') {
        logger.debug('Found a multistage build stage name');
        stageNames.push(fromRest[1]);
      }
      const fromSuffix = fromRest.join(' ');
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
      logger.info({ depName, currentTag, currentDigest }, 'Dockerfile FROM');
      if (currentFrom === 'scratch') {
        logger.debug('Skipping scratch');
      } else if (stageNames.includes(currentFrom)) {
        logger.debug({ currentFrom }, 'Skipping alias FROM');
      } else {
        const dep = {
          language: 'docker',
          lineNumber,
          fromLine,
          fromPrefix,
          currentFrom,
          fromSuffix,
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
    }
    lineNumber += 1;
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
