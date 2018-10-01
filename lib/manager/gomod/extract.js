const versioning = require('../../versioning');

const { isVersion } = versioning('semver');

module.exports = {
  extractDependencies,
};

function getDep(lineNumber, match) {
  const [, depName, currentValue] = match;
  const dep = {
    lineNumber,
    depName,
    depType: 'require',
    currentValue,
    versionScheme: 'semver',
  };
  if (!isVersion(currentValue)) {
    dep.skipReason = 'unsupported-version';
  } else if (depName.startsWith('gopkg.in/')) {
    const [pkg] = depName.replace('gopkg.in/', '').split('.');
    dep.depNameShort = pkg;
    if (pkg.includes('/')) {
      dep.purl = `pkg:github/${pkg}`;
    } else {
      dep.purl = `pkg:github/go-${pkg}/${pkg}`;
    }
  } else if (depName.startsWith('github.com/')) {
    dep.depNameShort = depName.replace('github.com/', '');
    dep.purl = 'pkg:' + depName.replace('github.com', 'github');
  } else {
    dep.purl = `pkg:go/${depName}`;
    dep.depNameShort = depName;
  }
  return dep;
}

function extractDependencies(content) {
  logger.debug('gomod.extractDependencies()');
  logger.trace({ content });
  const deps = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const requireMatch = line.match(/^require\s+([^\s]+)\s+([^\s]+)$/);
      if (requireMatch) {
        logger.trace(`Matched single-line require on line ${lineNumber}`);
        logger.debug(`require line: "${line}"`);
        const dep = getDep(lineNumber, requireMatch);
        deps.push(dep);
      }
      if (line.trim() === 'require (') {
        logger.trace(`Matched multi-line require on line ${lineNumber}`);
        do {
          lineNumber += 1;
          line = lines[lineNumber];
          const multiMatch = line.match(/^\s+([^\s]+)\s+([^\s]+)$/);
          logger.trace(`reqLine: "${line}"`);
          if (multiMatch) {
            logger.trace(`Matched multi-line require on line ${lineNumber}`);
            logger.debug(`require line: "${line}"`);
            const dep = getDep(lineNumber, multiMatch);
            dep.multiLine = true;
            deps.push(dep);
          } else if (line.trim() !== ')') {
            logger.debug(`No multi-line match: ${line}`);
          }
        } while (line.trim() !== ')');
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err, message: err.message }, 'Error extracting go modules');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
