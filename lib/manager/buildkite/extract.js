module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('buildkite.extractDependencies()');
  logger.trace({ content });
  const deps = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const plugins = line.match(/^\s*-?\s*plugins:\s*$/);
      if (plugins) {
        logger.trace(`Matched plugins on line ${lineNumber}`);
        const depLine = lines[lineNumber + 1];
        logger.debug(`serviceImageLine: "${depLine}"`);
        const depLineMatch = depLine.match(/^\s+([^#]+)#([^:]+):/);
        if (depLineMatch) {
          logger.trace('depLineMatch');
          lineNumber += 1;
          const [, depName, currentVersion] = depLineMatch;
          deps.push({
            lineNumber,
            depName,
            currentVersion,
          });
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error(
      { err, message: err.message },
      'Error extracting buildkite plugins'
    );
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
