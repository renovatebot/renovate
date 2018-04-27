module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('buildkite.extractDependencies()');
  logger.trace({ content });
  const deps = [];
  // Detect all dependencies within this pipeline.yml
  /*
    depType - use if there's a need to differentiate different "types" within the same file
    depName - package name
    currentVersion - current version or range in the file
  */
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
            depType: 'plugins',
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
  return deps;
}
