const { logger } = require('../../logger');

module.exports = {
  splitImageParts,
  getDep,
  extractPackageFile,
};

function splitImageParts(currentFrom) {
  if (currentFrom.includes('$')) {
    return {
      skipReason: 'contains-variable',
    };
  }
  const [currentDepTag, currentDigest] = currentFrom.split('@');
  const depTagSplit = currentDepTag.split(':');
  let depName;
  let currentValue;
  if (
    depTagSplit.length === 1 ||
    depTagSplit[depTagSplit.length - 1].includes('/')
  ) {
    depName = currentDepTag;
  } else {
    currentValue = depTagSplit.pop();
    depName = depTagSplit.join(':');
  }
  const dep = {
    depName,
    currentDigest,
    currentFrom,
    currentDepTag,
    currentValue,
  };
  return dep;
}

function getDep(currentFrom) {
  const dep = {
    ...splitImageParts(currentFrom),
    currentFrom,
  };
  dep.datasource = 'docker';
  if (
    dep.depName &&
    (dep.depName === 'node' || dep.depName.endsWith('/node')) &&
    dep.depName !== 'calico/node'
  ) {
    dep.commitMessageTopic = 'Node.js';
  }
  return dep;
}

function extractPackageFile(content) {
  const deps = [];
  const stageNames = [];
  let lineNumber = 0;
  for (const fromLine of content.split('\n')) {
    const fromMatch = fromLine.match(/^FROM /i);
    if (fromMatch) {
      logger.trace({ lineNumber, fromLine }, 'FROM line');
      const [fromPrefix, currentFrom, ...fromRest] = fromLine.match(/\S+/g);
      if (fromRest.length === 2 && fromRest[0].toLowerCase() === 'as') {
        logger.debug('Found a multistage build stage name');
        stageNames.push(fromRest[1]);
      }
      const fromSuffix = fromRest.join(' ');
      if (currentFrom === 'scratch') {
        logger.debug('Skipping scratch');
      } else if (stageNames.includes(currentFrom)) {
        logger.debug({ currentFrom }, 'Skipping alias FROM');
      } else {
        const dep = getDep(currentFrom);
        logger.trace(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'Dockerfile FROM'
        );
        dep.lineNumber = lineNumber;
        dep.fromPrefix = fromPrefix;
        dep.fromSuffix = fromSuffix;
        deps.push(dep);
      }
    }

    const copyFromMatch = fromLine.match(/^(COPY --from=)([^\s]+)\s+(.*)$/i);
    if (copyFromMatch) {
      const [fromPrefix, currentFrom, fromSuffix] = copyFromMatch.slice(1);
      logger.trace({ lineNumber, fromLine }, 'COPY --from line');
      if (stageNames.includes(currentFrom)) {
        logger.debug({ currentFrom }, 'Skipping alias COPY --from');
      } else if (!Number.isNaN(Number(currentFrom))) {
        logger.debug({ currentFrom }, 'Skipping index reference COPY --from');
      } else {
        const dep = getDep(currentFrom);
        logger.info(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'Dockerfile COPY --from'
        );
        dep.lineNumber = lineNumber;
        dep.fromPrefix = fromPrefix;
        dep.fromSuffix = fromSuffix;
        deps.push(dep);
      }
    }
    lineNumber += 1;
  }
  if (!deps.length) {
    return null;
  }
  for (const d of deps) d.depType = 'stage';
  deps[deps.length - 1].depType = 'final';
  return { deps };
}
