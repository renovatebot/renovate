module.exports = {
  splitImageParts,
  extractDependencies,
};

function groupedRegex(string, pattern) {
  const matches = string.match(new RegExp(pattern.source, pattern.flags));
  if (!matches) {
    return [];
  }
  return matches.map(
    match => new RegExp(pattern.source, pattern.flags).exec(match)[1]
  );
}

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
  return {
    dockerRegistry,
    depName,
    currentTag,
    currentDigest,
    currentDepTagDigest,
    currentDepTag,
  };
}

function extractDependencies(content) {
  logger.debug('docker.extractDependencies()');
  const deps = [];
  const fromMatches = groupedRegex(content, /(?:^|\n)(FROM .+)\n/gi);
  if (!fromMatches.length) {
    logger.info('No FROM found');
    logger.debug({ content });
    return null;
  }
  logger.debug({ fromMatches }, 'Found matches');
  const stageNames = [];
  fromMatches.forEach(fromLine => {
    logger.debug({ fromLine }, 'fromLine');
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
    } = splitImageParts(currentFrom);
    logger.info({ depName, currentTag, currentDigest }, 'Dockerfile FROM');
    if (currentFrom === 'scratch') {
      logger.debug('Skipping scratch');
    } else if (stageNames.includes(currentFrom)) {
      logger.debug({ currentFrom }, 'Skipping alias FROM');
    } else {
      deps.push({
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
      });
    }
  });
  if (!deps.length) {
    return null;
  }
  return { deps };
}
