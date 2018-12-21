const { isVersion } = require('../../versioning/semver');

module.exports = {
  extractPackageFile,
};

function getDep(lineNumber, match) {
  const [, , currentValue] = match;
  let [, depName] = match;
  depName = depName.replace(/"/g, '');
  const dep = {
    lineNumber,
    depName,
    depType: 'require',
    currentValue,
  };
  if (!isVersion(currentValue)) {
    dep.skipReason = 'unsupported-version';
  } else {
    if (depName.startsWith('gopkg.in/')) {
      const [pkg] = depName.replace('gopkg.in/', '').split('.');
      dep.depNameShort = pkg;
    } else if (depName.startsWith('github.com/')) {
      dep.depNameShort = depName.replace('github.com/', '');
    } else {
      dep.depNameShort = depName;
    }
    dep.purl = `pkg:go/${depName}`;
  }
  const digestMatch = currentValue.match(/v0\.0.0-\d{14}-([a-f0-9]{12})/);
  if (digestMatch) {
    [, dep.currentDigest] = digestMatch;
    dep.digestOneAndOnly = true;
  }
  return dep;
}

function extractPackageFile(content) {
  logger.debug('gomod.extractPackageFile()');
  logger.trace({ content });
  const deps = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const requireMatch = line.match(/^require\s+([^\s]+)\s+([^\s]+)/);
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
          const multiMatch = line.match(/^\s+([^\s]+)\s+([^\s]+)/);
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
